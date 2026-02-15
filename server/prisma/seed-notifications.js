const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = [
    { type: 'WELCOME', channel: 'EMAIL', subject: 'Welcome to FlowApp, {{firstName}}!', body: 'Hi {{firstName}},\nWelcome to FlowApp! Explore your classes, track your belt progress, and stay on top of your training.\nSee you on the mat!' },
    { type: 'WELCOME', channel: 'IN_APP', body: 'Welcome to FlowApp, {{firstName}}! Head to your dashboard to get started.' },
    { type: 'BIRTHDAY', channel: 'EMAIL', subject: 'Happy Birthday, {{firstName}}!', body: 'Happy Birthday, {{firstName}}! Wishing you an awesome day.' },
    { type: 'BIRTHDAY', channel: 'IN_APP', body: 'Happy Birthday, {{firstName}}! Have a great day!' },
    { type: 'MISSED_CLASS', channel: 'EMAIL', subject: 'We miss you, {{firstName}}!', body: 'Hi {{firstName}}, we noticed you haven\'t attended class in a while. Come back soon!' },
    { type: 'MISSED_CLASS', channel: 'IN_APP', body: 'You haven\'t checked in recently. We miss you!' },
    { type: 'PAYMENT_REMINDER', channel: 'EMAIL', subject: 'Payment Reminder — ${{amount}} due {{dueDate}}', body: 'Hi {{firstName}}, your payment of ${{amount}} is due on {{dueDate}}.' },
    { type: 'PAYMENT_REMINDER', channel: 'IN_APP', body: 'Payment reminder: ${{amount}} due {{dueDate}}.' },
    { type: 'PAYMENT_RECEIPT', channel: 'EMAIL', subject: 'Payment Received', body: 'Hi {{firstName}}, thank you for your payment of ${{amount}}.' },
    { type: 'CLASS_CHANGE', channel: 'EMAIL', subject: 'Class Schedule Update', body: 'Hi {{firstName}}, there has been a change to your class schedule.' },
    { type: 'CLASS_CHANGE', channel: 'IN_APP', body: 'A class you\'re enrolled in has been updated.' },
    { type: 'CLASS_CANCELLED', channel: 'EMAIL', subject: 'Class Cancelled', body: 'Hi {{firstName}}, your class has been cancelled.' },
    { type: 'CLASS_CANCELLED', channel: 'IN_APP', body: 'A class has been cancelled.' },
    { type: 'PROMOTION', channel: 'EMAIL', subject: 'Congratulations on Your Promotion!', body: 'Congratulations, {{firstName}}! You\'ve been promoted.' },
    { type: 'PROMOTION', channel: 'IN_APP', body: 'Congratulations! You\'ve been promoted.' },
    { type: 'TEST_SCHEDULED', channel: 'EMAIL', subject: 'Belt Test Scheduled', body: 'Hi {{firstName}}, a belt test has been scheduled.' },
    { type: 'TEST_SCHEDULED', channel: 'IN_APP', body: 'A belt test has been scheduled.' },
    { type: 'INVOICE_CREATED', channel: 'EMAIL', subject: 'New Invoice — ${{amount}}', body: 'Hi {{firstName}}, a new invoice for ${{amount}} has been created.' },
    { type: 'INVOICE_CREATED', channel: 'IN_APP', body: 'A new invoice for ${{amount}} has been created.' },
    { type: 'GENERAL', channel: 'EMAIL', subject: '{{subject}}', body: '{{body}}' },
    { type: 'GENERAL', channel: 'IN_APP', body: '{{body}}' },
    { type: 'GENERAL', channel: 'SMS', body: '{{body}}' },
  ];

  let count = 0;
  for (const t of templates) {
    const exists = await prisma.notificationTemplate.findFirst({
      where: { schoolId: null, type: t.type, channel: t.channel },
    });
    if (!exists) {
      await prisma.notificationTemplate.create({ data: t });
      count++;
    }
  }
  console.log(`Created ${count} notification templates`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
