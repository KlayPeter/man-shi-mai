import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const createCodeSandboxTool = () => {
  return new DynamicStructuredTool({
    name: 'run_javascript_code',
    description: '执行候选人提供的 JavaScript 算法代码，并返回运行结果或控制台输出。',
    schema: z.object({
      code: z.string().describe('候选人编写的完整 JS 代码，包含测试用例的调用')
    }),
    func: async ({ code }) => {
      const tempDir = path.join(process.cwd(), 'scratch/sandbox');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const fileName = `run_${Date.now()}_${Math.random().toString(36).substring(7)}.js`;
      const filePath = path.join(tempDir, fileName);

      // 禁用全局 process 和 require 对象以增加安全性
      const fullScript = `
        global.process = undefined;
        global.require = undefined;
        try {
          ${code}
        } catch (e) {
          console.error("运行时异常: " + e.message);
        }
      `;

      try {
        await fs.promises.writeFile(filePath, fullScript, 'utf8');

        // 超时熔断限制：timeout: 2000ms, maxBuffer: 100KB
        const { stdout, stderr } = await execPromise(`node ${filePath}`, {
          timeout: 2000, 
          maxBuffer: 1024 * 100
        });

        await fs.promises.unlink(filePath);
        return JSON.stringify({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
      } catch (error: any) {
        if (fs.existsSync(filePath)) await fs.promises.unlink(filePath).catch(() => {});
        if (error.killed && error.signal === 'SIGTERM') {
          return JSON.stringify({ success: false, error: 'Execution Timeout: 代码执行超出2000ms时限，可能存在死循环！' });
        }
        return JSON.stringify({ success: false, error: error.message || '执行出错' });
      }
    }
  });
};
