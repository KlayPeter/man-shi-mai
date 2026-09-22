/**
 * 面试猫 API 完整测试脚本
 * 
 * 使用方法：
 * node test-all-apis.js
 * 
 * 或者使用 npm script:
 * npm run test:api
 */

const https = require('https');
const http = require('http');

// 配置
const API_BASE_URL = 'http://localhost:3000';
let authToken = null;
let testUserId = null;
let testOrderId = null;
let testResumeId = null;
let testUserEmail = null;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// HTTP 请求封装
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject({ statusCode: res.statusCode, body: response });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 测试用例
const tests = {
  // 1. 用户注册
  async testRegister() {
    logInfo('测试用户注册...');
    try {
      const timestamp = Date.now();
      testUserEmail = `test${timestamp}@666.com`;
      const response = await request('POST', '/user/register', {
        email: testUserEmail,
        username: `testuser${timestamp}`,
        password: '123456',
      });
      
      if (response.code === 200) {
        logSuccess('用户注册成功');
        return true;
      }
    } catch (error) {
      if (error.body?.message?.includes('已被注册')) {
        logWarning('用户已存在，跳过注册');
        return true;
      }
      logError(`用户注册失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 2. 用户登录
  async testLogin() {
    logInfo('测试用户登录...');
    try {
      const response = await request('POST', '/user/login', {
        email: testUserEmail || 'test@666.com',
        password: '123456',
      });
      
      if (response.code === 200 && response.data.token) {
        authToken = response.data.token;
        testUserId = response.data.user._id;
        logSuccess(`用户登录成功，Token: ${authToken.substring(0, 20)}...`);
        return true;
      }
    } catch (error) {
      logError(`用户登录失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 3. 获取用户信息
  async testGetUserInfo() {
    logInfo('测试获取用户信息...');
    try {
      const response = await request('GET', '/user/info', null, authToken);
      
      if (response.code === 200) {
        logSuccess(`获取用户信息成功: ${response.data.email}`);
        log(`   - 小麦币余额: ${response.data.maiCoinBalance || 0}`, 'blue');
        log(`   - 简历押题: ${response.data.resumeRemainingCount || 0} 次`, 'blue');
        log(`   - 专项面试: ${response.data.specialRemainingCount || 0} 次`, 'blue');
        log(`   - 综合面试: ${response.data.behaviorRemainingCount || 0} 次`, 'blue');
        return true;
      }
    } catch (error) {
      logError(`获取用户信息失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 4. 创建支付订单 - Custom套餐
  async testCreatePaymentCustom() {
    logInfo('测试创建支付订单（Custom套餐）...');
    try {
      const response = await request('POST', '/payment/order', {
        planId: 'custom',
        amount: 100,
        planName: '自定义充值',
        description: '充值100元',
        currency: 'CNY',
        channel: 'alipay',
        source: 'web',
      }, authToken);
      
      if (response.code === 200) {
        testOrderId = response.data.orderId;
        logSuccess(`创建支付订单成功: ${testOrderId}`);
        log(`   - 二维码URL: ${response.data.codeUrl}`, 'blue');
        return true;
      }
    } catch (error) {
      logError(`创建支付订单失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 5. 查询支付状态
  async testQueryPaymentStatus() {
    logInfo('测试查询支付状态...');
    if (!testOrderId) {
      logWarning('跳过：没有订单ID');
      return true;
    }
    
    try {
      const response = await request('POST', '/payment/order/status', {
        orderId: testOrderId,
        channel: 'alipay',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`查询支付状态成功: ${response.data.success ? '已支付' : '未支付'}`);
        return true;
      }
    } catch (error) {
      logError(`查询支付状态失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 6. 创建支付订单 - Single套餐
  async testCreatePaymentSingle() {
    logInfo('测试创建支付订单（Single套餐）...');
    try {
      const response = await request('POST', '/payment/order', {
        planId: 'single',
        amount: 18.8,
        planName: '单次套餐',
        description: '购买单次套餐',
        currency: 'CNY',
        channel: 'alipay',
        source: 'web',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`创建Single套餐订单成功: ${response.data.orderId}`);
        return true;
      }
    } catch (error) {
      logError(`创建Single套餐订单失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 7. 创建支付订单 - Pro套餐
  async testCreatePaymentPro() {
    logInfo('测试创建支付订单（Pro套餐）...');
    try {
      const response = await request('POST', '/payment/order', {
        planId: 'pro',
        amount: 28.8,
        planName: '专业套餐',
        description: '购买专业套餐',
        currency: 'CNY',
        channel: 'alipay',
        source: 'web',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`创建Pro套餐订单成功: ${response.data.orderId}`);
        return true;
      }
    } catch (error) {
      logError(`创建Pro套餐订单失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 8. 小麦币兑换 - 简历押题
  async testExchangeResume() {
    logInfo('测试小麦币兑换（简历押题）...');
    try {
      const response = await request('POST', '/interview/exchange-package', {
        packageType: 'resume',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`兑换简历押题成功`);
        log(`   - 剩余小麦币: ${response.data.remainingMaiCoin}`, 'blue');
        log(`   - 剩余次数: ${response.data.remainingCount}`, 'blue');
        return true;
      }
    } catch (error) {
      if (error.body?.message?.includes('余额不足')) {
        logWarning('小麦币余额不足，跳过兑换测试');
        return true;
      }
      logError(`兑换简历押题失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 9. 小麦币兑换 - 专项面试
  async testExchangeSpecial() {
    logInfo('测试小麦币兑换（专项面试）...');
    try {
      const response = await request('POST', '/interview/exchange-package', {
        packageType: 'special',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`兑换专项面试成功`);
        return true;
      }
    } catch (error) {
      if (error.body?.message?.includes('余额不足')) {
        logWarning('小麦币余额不足，跳过兑换测试');
        return true;
      }
      logError(`兑换专项面试失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 10. 小麦币兑换 - 综合面试
  async testExchangeBehavior() {
    logInfo('测试小麦币兑换（综合面试）...');
    try {
      const response = await request('POST', '/interview/exchange-package', {
        packageType: 'behavior',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`兑换综合面试成功`);
        return true;
      }
    } catch (error) {
      if (error.body?.message?.includes('余额不足')) {
        logWarning('小麦币余额不足，跳过兑换测试');
        return true;
      }
      logError(`兑换综合面试失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 11. 获取消费记录
  async testGetConsumptionRecords() {
    logInfo('测试获取消费记录...');
    try {
      const response = await request('GET', '/user/consumption-records?skip=0&limit=10', null, authToken);
      
      if (response.code === 200) {
        const count = response.data.records?.length || 0;
        logSuccess(`获取消费记录成功，共 ${count} 条记录`);
        return true;
      }
    } catch (error) {
      logError(`获取消费记录失败: ${error.body?.message || error.message}`);
      return false;
    }
  },

  // 12. 更新用户信息
  async testUpdateUserProfile() {
    logInfo('测试更新用户信息...');
    try {
      const response = await request('PUT', '/user/profile', {
        username: 'testuser_updated',
      }, authToken);
      
      if (response.code === 200) {
        logSuccess(`更新用户信息成功`);
        return true;
      }
    } catch (error) {
      logError(`更新用户信息失败: ${error.body?.message || error.message}`);
      return false;
    }
  },
};

// 运行所有测试
async function runAllTests() {
  log('\n========================================', 'cyan');
  log('🚀 开始测试所有API接口', 'cyan');
  log('========================================\n', 'cyan');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const [name, testFn] of Object.entries(tests)) {
    results.total++;
    log(`\n[${results.total}/${Object.keys(tests).length}] ${name}`, 'yellow');
    log('----------------------------------------', 'yellow');
    
    try {
      const result = await testFn();
      if (result) {
        results.passed++;
      } else {
        results.failed++;
      }
      
      // 每个测试之间暂停500ms
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.failed++;
      logError(`测试异常: ${error.message}`);
    }
  }

  // 输出测试报告
  log('\n========================================', 'cyan');
  log('📊 测试报告', 'cyan');
  log('========================================', 'cyan');
  log(`总计: ${results.total}`, 'blue');
  log(`通过: ${results.passed}`, 'green');
  log(`失败: ${results.failed}`, 'red');
  log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`, 'cyan');
  log('========================================\n', 'cyan');

  if (results.failed === 0) {
    logSuccess('🎉 所有测试通过！');
    process.exit(0);
  } else {
    logError(`❌ 有 ${results.failed} 个测试失败`);
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  logInfo('检查服务器状态...');
  try {
    await request('GET', '/');
    logSuccess('服务器运行正常');
    return true;
  } catch (error) {
    logError('服务器未运行或无法连接');
    logError('请先启动服务器: npm run start:dev');
    process.exit(1);
  }
}

// 主函数
async function main() {
  try {
    await checkServer();
    await runAllTests();
  } catch (error) {
    logError(`测试执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行测试
main();
