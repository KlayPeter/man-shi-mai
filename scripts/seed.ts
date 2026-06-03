import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/manshimai';

async function run() {
  console.log('Connecting to database:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection.db is not defined');
  }
  console.log('Connected to MongoDB successfully.');

  // Clean existing seed users and records
  const emailsToClean = ['testuser@example.com', 'vipuser@example.com'];
  const cleanedUsers = await db.collection('users').find({ email: { $in: emailsToClean } }).toArray();
  const userIds = cleanedUsers.map(u => String(u._id));

  if (userIds.length > 0) {
    console.log(`Cleaning existing records for seed users: ${emailsToClean.join(', ')}`);
    await db.collection('users').deleteMany({ email: { $in: emailsToClean } });
    await db.collection('resumes').deleteMany({ userId: { $in: userIds } });
    await db.collection('paymentrecords').deleteMany({ userId: { $in: userIds } });
    await db.collection('usertransactions').deleteMany({ userIdentifier: { $in: userIds } });
  }

  // Create password hash
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create Standard User
  const standardUserId = new mongoose.Types.ObjectId();
  const standardUser = {
    _id: standardUserId,
    username: 'testuser',
    email: 'testuser@example.com',
    password: passwordHash,
    roles: ['user'],
    isActive: true,
    isVip: false,
    aiInterviewRemainingCount: 2,
    aiInterviewRemainingMinutes: 20,
    maiCoinBalance: 20,
    resumeRemainingCount: 2,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 2. Create VIP User
  const vipUserId = new mongoose.Types.ObjectId();
  const vipUser = {
    _id: vipUserId,
    username: 'vipuser',
    email: 'vipuser@example.com',
    password: passwordHash,
    roles: ['user'],
    isActive: true,
    isVip: true,
    vipExpireTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days VIP
    aiInterviewRemainingCount: 20,
    aiInterviewRemainingMinutes: 300,
    maiCoinBalance: 500,
    resumeRemainingCount: 15,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('users').insertMany([standardUser, vipUser]);
  console.log('Seed users successfully created.');

  // 3. Create Resumes
  const resumes = [
    {
      userId: String(standardUserId),
      resumeName: '测试用户简历_前端开发.pdf',
      url: 'https://lgdsunday.club/mock-frontend-resume.pdf',
      uploadTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      userId: String(vipUserId),
      resumeName: 'VIP用户简历_架构师.pdf',
      url: 'https://lgdsunday.club/mock-architect-resume.pdf',
      uploadTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.collection('resumes').insertMany(resumes);
  console.log('Seed resumes successfully created.');

  // 4. Create Payment Records
  const paymentRecords = [
    {
      orderId: 'seed-order-001',
      userId: String(vipUserId),
      channel: 'alipay',
      amount: 68.8,
      currency: 'CNY',
      planId: 'max',
      planName: 'Max Plan',
      source: 'web',
      description: 'Max Plan VIP Subscription',
      status: 'success',
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.collection('paymentrecords').insertMany(paymentRecords);
  console.log('Seed payment records successfully created.');

  // 5. Create User Transactions
  const userTransactions = [
    {
      userIdentifier: String(vipUserId),
      type: 'recharge',
      amount: 500,
      currency: 'CNY',
      description: 'System seed credit recharge',
      planId: 'max',
      planName: 'Max Plan',
      source: 'system',
      relatedOrderId: 'seed-order-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.collection('usertransactions').insertMany(userTransactions);
  console.log('Seed user transactions successfully created.');

  console.log('Database seeding successfully finished.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Seeding database failed:', err);
  process.exit(1);
});
