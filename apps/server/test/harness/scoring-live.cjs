/* Opt-in real-provider calibration on synthetic, hand-written answers. No database. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
if (process.env.RUN_SCORING_LIVE !== '1' || !process.env.DEEPSEEK_API_KEY) throw Error('RUN_SCORING_LIVE=1 and a provider key required; this consumes real usage');
const { ConfigService } = require('@nestjs/config');
const { AIModelFactory } = require('../../dist/src/ai/services/ai-model.factory');
const { InterviewAIService } = require('../../dist/src/interview/services/interview-ai.service');
const cases = require('./candidate-profiles/scoring-cases.json');
assert.equal(cases.length, 3, 'Keep this acceptance bounded to three calls');
const config = new ConfigService({ DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-flash', MAX_TOKENS: 8000, DEEPSEEK_TEMPERATURE: 0, DEEPSEEK_THINKING_MODE: 'disabled' });
const factory = new AIModelFactory(config);
const original = factory.createDefaultModel.bind(factory);
const artifact = { model: config.get('DEEPSEEK_MODEL'), startedAt: new Date().toISOString(), calls: 0, usage: [], cases: [] };
const destination = path.join(os.tmpdir(), 'msm-scoring-acceptance.json');
const save = () => fs.writeFileSync(destination, JSON.stringify(artifact, null, 2), { mode: 0o600 });
factory.createDefaultModel = () => {
  assert(++artifact.calls <= 3, 'Model call limit');
  const model = original(); model.maxRetries = 0; model.timeout = 60000;
  model.callbacks = [{ handleLLMEnd(output) { artifact.usage.push(output.generations?.[0]?.[0]?.message?.usage_metadata || null); } }];
  return model;
};
const ai = new InterviewAIService(config, factory);
(async () => {
  for (const fixture of cases) {
    const report = await ai.generateInterviewAssessmentReport(fixture.context, AbortSignal.timeout(90000));
    artifact.cases.push({ id: fixture.id, report }); save();
    const [min, max] = fixture.expectedScoreRange;
    assert(report.overallScore !== null && report.overallScore >= min && report.overallScore <= max, `${fixture.id} outside expected evidence range; inspect artifact before changing the rubric`);
    for (const number of fixture.excludedQuestions) assert.equal(report.questionAssessments.find(item => item.questionNumber === number)?.score, null);
    console.log(`${fixture.id}: ${report.overallScore}, ${report.overallLevel}`);
  }
  assert(artifact.cases[0].report.overallScore > artifact.cases[1].report.overallScore, 'Adequate answers must outrank off-topic answers');
  console.log(`PASS: three real-provider cases; exact evidence and complete coverage validated. Synthetic artifact: ${destination}`);
})().catch(error => { artifact.error = error.message; save(); console.error(error.message); process.exitCode = 1; });
