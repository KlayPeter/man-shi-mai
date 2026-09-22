const fs = require('fs');
const path = require('path');

const skillsDir = __dirname;
const readmePath = path.join(skillsDir, 'README.md');

function parseMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let name = '';
  let id = path.basename(path.dirname(filePath));
  let version = '1.0.0';
  let description = '';

  // YAML Frontmatter parsing
  if (content.trim().startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      const yamlContent = parts[1];
      const lines = yamlContent.split('\n');
      for (const line of lines) {
        const matchName = line.match(/^name:\s*(.+)$/i);
        const matchDesc = line.match(/^description:\s*(.+)$/i);
        const matchVer = line.match(/^version:\s*(.+)$/i);
        if (matchName) name = matchName[1].trim();
        if (matchDesc) description = matchDesc[1].trim();
        if (matchVer) version = matchVer[1].trim();
      }
    }
  }

  // Markdown bullet list parsing
  const lines = content.split('\n');
  for (const line of lines) {
    if (!name) {
      const match = line.match(/-\s+\*\*名称(?:\s*\(Name\))?\*\*:\s*(.+)$/i);
      if (match) name = match[1].trim();
    }
    if (!id) {
      const match = line.match(/-\s+\*\*标识(?:\s*\(ID\))?\*\*:\s*(.+)$/i);
      if (match) id = match[1].trim();
    }
    if (version === '1.0.0') {
      const match = line.match(/-\s+\*\*版本(?:\s*\(Version\))?\*\*:\s*(.+)$/i);
      if (match) version = match[1].trim();
    }
    if (!description) {
      const match = line.match(/-\s+\*\*核心目的(?:\s*\(Goal\))?\*\*:\s*(.+)$/i) || 
                    line.match(/-\s+\*\*核心作用(?:\s*\(Short Description\))?\*\*:\s*(.+)$/i) ||
                    line.match(/-\s+\*\*描述(?:\s*\(Description\))?\*\*:\s*(.+)$/i);
      if (match) description = match[1].trim();
    }
  }

  if (!name) name = id;
  return { name, id, version, description };
}

function run() {
  const items = fs.readdirSync(skillsDir);
  const skills = [];

  for (const item of items) {
    const itemPath = path.join(skillsDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    
    // Ignore meta/system directories
    if (['references', 'agents', 'scripts', 'assets'].includes(item)) continue;

    let skillFile = '';
    if (fs.existsSync(path.join(itemPath, 'SKILL.md'))) {
      skillFile = 'SKILL.md';
    } else if (fs.existsSync(path.join(itemPath, 'README.md'))) {
      skillFile = 'README.md';
    }

    if (skillFile) {
      try {
        const filePath = path.join(itemPath, skillFile);
        const meta = parseMetadata(filePath);
        skills.push({
          dir: item,
          file: skillFile,
          ...meta
        });
      } catch (err) {
        console.error(`Error parsing skill in ${item}:`, err.message);
      }
    }
  }

  // Sort by name
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // Generate markdown table
  let table = '<!-- SKILLS_LIST_START -->\n';
  table += '| 技能目录 / Directory | 技能名称 / Name | 标识 / ID | 版本 / Version | 状态 / Status | 核心作用 / Short Description |\n';
  table += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
  for (const s of skills) {
    const relativeLink = `${s.dir}/${s.file}`;
    table += `| [${s.dir}/](${relativeLink}) | ${s.name} | \`${s.id}\` | \`${s.version}\` | 🟢 开启中 (Active) | ${s.description} |\n`;
  }
  table += '<!-- SKILLS_LIST_END -->';

  if (!fs.existsSync(readmePath)) {
    console.error('README.md not found in skills directory!');
    return;
  }

  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  const startTag = '<!-- SKILLS_LIST_START -->';
  const endTag = '<!-- SKILLS_LIST_END -->';

  if (readmeContent.includes(startTag) && readmeContent.includes(endTag)) {
    const pattern = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
    readmeContent = readmeContent.replace(pattern, table);
  } else {
    // Fallback: try to insert under "## 技能索引与元数据..."
    const headerPattern = /## 技能索引与元数据 \/ Skills Index & Metadata\s*\n/;
    if (headerPattern.test(readmeContent)) {
      readmeContent = readmeContent.replace(headerPattern, `## 技能索引与元数据 / Skills Index & Metadata\n\n${table}\n`);
    } else {
      readmeContent += `\n\n## 技能索引与元数据 / Skills Index & Metadata\n\n${table}\n`;
    }
  }

  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log('Successfully updated README.md with installed skills!');
}

run();
