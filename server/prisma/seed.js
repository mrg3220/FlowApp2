const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Super Admin ──────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@flowapp.com' },
    update: {},
    create: {
      email: 'admin@flowapp.com',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      phone: '555-0001',
      role: 'SUPER_ADMIN',
      bio: 'Platform administrator for FlowApp network.',
    },
  });
  console.log(`  ✅ Super Admin: ${superAdmin.email}`);

  // ─── Owners ───────────────────────────────────────
  const ownerPassword = await bcrypt.hash('owner123', 12);
  const owner1 = await prisma.user.upsert({
    where: { email: 'owner@flowapp.com' },
    update: {},
    create: {
      email: 'owner@flowapp.com',
      passwordHash: ownerPassword,
      firstName: 'Studio',
      lastName: 'Owner',
      phone: '555-0100',
      role: 'OWNER',
      bio: 'Founder of Dragon Martial Arts.',
      beltRank: 'Black Belt 3rd Dan',
    },
  });
  const owner2 = await prisma.user.upsert({
    where: { email: 'owner2@flowapp.com' },
    update: {},
    create: {
      email: 'owner2@flowapp.com',
      passwordHash: ownerPassword,
      firstName: 'Lisa',
      lastName: 'Chen',
      phone: '555-0101',
      role: 'OWNER',
      bio: 'Owner of Phoenix Dojo.',
      beltRank: 'Black Belt 2nd Dan',
    },
  });
  console.log(`  ✅ Owners: ${owner1.email}, ${owner2.email}`);

  // ─── Schools ──────────────────────────────────────
  const school1 = await prisma.school.create({
    data: {
      name: 'Dragon Martial Arts',
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      phone: '555-1000',
      email: 'info@dragonma.com',
      ownerId: owner1.id,
    },
  });
  const school2 = await prisma.school.create({
    data: {
      name: 'Phoenix Dojo',
      address: '456 Oak Ave',
      city: 'Shelbyville',
      state: 'IL',
      zip: '62565',
      phone: '555-2000',
      email: 'info@phoenixdojo.com',
      ownerId: owner2.id,
    },
  });
  console.log(`  ✅ Schools: ${school1.name}, ${school2.name}`);

  // Link owners to their school
  await prisma.user.update({ where: { id: owner1.id }, data: { schoolId: school1.id } });
  await prisma.user.update({ where: { id: owner2.id }, data: { schoolId: school2.id } });

  // ─── Instructors ──────────────────────────────────
  const instructorPassword = await bcrypt.hash('instructor123', 12);
  const instructor1 = await prisma.user.upsert({
    where: { email: 'sensei.mike@flowapp.com' },
    update: {},
    create: {
      email: 'sensei.mike@flowapp.com',
      passwordHash: instructorPassword,
      firstName: 'Mike',
      lastName: 'Tanaka',
      phone: '555-0201',
      role: 'INSTRUCTOR',
      schoolId: school1.id,
      bio: 'Karate and Kickboxing instructor with 15 years experience.',
      beltRank: 'Black Belt 2nd Dan',
    },
  });
  const instructor2 = await prisma.user.upsert({
    where: { email: 'coach.sarah@flowapp.com' },
    update: {},
    create: {
      email: 'coach.sarah@flowapp.com',
      passwordHash: instructorPassword,
      firstName: 'Sarah',
      lastName: 'Martinez',
      phone: '555-0202',
      role: 'INSTRUCTOR',
      schoolId: school1.id,
      bio: 'Brazilian Jiu-Jitsu specialist, IBJJF certified.',
      beltRank: 'Purple Belt',
    },
  });
  const instructor3 = await prisma.user.upsert({
    where: { email: 'coach.raj@flowapp.com' },
    update: {},
    create: {
      email: 'coach.raj@flowapp.com',
      passwordHash: instructorPassword,
      firstName: 'Raj',
      lastName: 'Patel',
      phone: '555-0203',
      role: 'INSTRUCTOR',
      schoolId: school2.id,
      bio: 'Muay Thai and MMA coach.',
      beltRank: 'Kru Level 3',
    },
  });
  console.log(`  ✅ Instructors: ${instructor1.email}, ${instructor2.email}, ${instructor3.email}`);

  // ─── Students ─────────────────────────────────────
  const studentPassword = await bcrypt.hash('student123', 12);
  const studentData = [
    { email: 'alex@example.com', firstName: 'Alex', lastName: 'Johnson', beltRank: 'Blue Belt' },
    { email: 'jamie@example.com', firstName: 'Jamie', lastName: 'Williams', beltRank: 'White Belt' },
    { email: 'taylor@example.com', firstName: 'Taylor', lastName: 'Brown', beltRank: 'Yellow Belt' },
    { email: 'casey@example.com', firstName: 'Casey', lastName: 'Davis', beltRank: 'Green Belt' },
    { email: 'morgan@example.com', firstName: 'Morgan', lastName: 'Wilson', beltRank: 'White Belt' },
    { email: 'pat@example.com', firstName: 'Pat', lastName: 'Lee', beltRank: 'Orange Belt' },
    { email: 'jordan@example.com', firstName: 'Jordan', lastName: 'Kim', beltRank: 'White Belt' },
  ];

  const students = [];
  for (const s of studentData) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: studentPassword,
        firstName: s.firstName,
        lastName: s.lastName,
        role: 'STUDENT',
        beltRank: s.beltRank,
      },
    });
    students.push(student);
  }
  console.log(`  ✅ Students: ${students.length} created`);

  // ─── Enrollments ──────────────────────────────────
  // Students 0-3 at Dragon, 4-6 at Phoenix
  for (let i = 0; i < 4; i++) {
    await prisma.enrollment.create({
      data: { studentId: students[i].id, schoolId: school1.id, status: 'ACTIVE' },
    });
    await prisma.user.update({ where: { id: students[i].id }, data: { schoolId: school1.id } });
  }
  for (let i = 4; i < students.length; i++) {
    await prisma.enrollment.create({
      data: { studentId: students[i].id, schoolId: school2.id, status: 'ACTIVE' },
    });
    await prisma.user.update({ where: { id: students[i].id }, data: { schoolId: school2.id } });
  }
  console.log(`  ✅ Enrollments: 4 at ${school1.name}, 3 at ${school2.name}`);

  // ─── Classes (School 1 — Dragon) ─────────────────
  const karateClass = await prisma.class.create({
    data: {
      name: 'Evening Karate',
      discipline: 'Karate',
      skillLevel: 'ALL_LEVELS',
      capacity: 20,
      description: 'Traditional Shotokan karate for all levels',
      instructorId: instructor1.id,
      schoolId: school1.id,
      schedules: {
        create: [
          { dayOfWeek: 'MON', startTime: '18:00', endTime: '19:30', effectiveFrom: new Date('2026-01-01') },
          { dayOfWeek: 'WED', startTime: '18:00', endTime: '19:30', effectiveFrom: new Date('2026-01-01') },
        ],
      },
    },
  });

  const bjjClass = await prisma.class.create({
    data: {
      name: 'BJJ Fundamentals',
      discipline: 'Brazilian Jiu-Jitsu',
      skillLevel: 'BEGINNER',
      capacity: 15,
      description: 'Learn the basics of Brazilian Jiu-Jitsu',
      instructorId: instructor2.id,
      schoolId: school1.id,
      schedules: {
        create: [
          { dayOfWeek: 'TUE', startTime: '19:00', endTime: '20:30', effectiveFrom: new Date('2026-01-01') },
          { dayOfWeek: 'THU', startTime: '19:00', endTime: '20:30', effectiveFrom: new Date('2026-01-01') },
        ],
      },
    },
  });

  const kickboxingClass = await prisma.class.create({
    data: {
      name: 'Kickboxing Cardio',
      discipline: 'Kickboxing',
      skillLevel: 'ALL_LEVELS',
      capacity: 25,
      description: 'High-energy kickboxing workout',
      instructorId: instructor1.id,
      schoolId: school1.id,
      schedules: {
        create: [
          { dayOfWeek: 'FRI', startTime: '17:00', endTime: '18:00', effectiveFrom: new Date('2026-01-01') },
          { dayOfWeek: 'SAT', startTime: '10:00', endTime: '11:00', effectiveFrom: new Date('2026-01-01') },
        ],
      },
    },
  });
  console.log(`  ✅ School 1 Classes: ${karateClass.name}, ${bjjClass.name}, ${kickboxingClass.name}`);

  // ─── Classes (School 2 — Phoenix) ─────────────────
  const muayThaiClass = await prisma.class.create({
    data: {
      name: 'Muay Thai Basics',
      discipline: 'Muay Thai',
      skillLevel: 'BEGINNER',
      capacity: 18,
      description: 'Introduction to the art of eight limbs',
      instructorId: instructor3.id,
      schoolId: school2.id,
      schedules: {
        create: [
          { dayOfWeek: 'MON', startTime: '17:00', endTime: '18:30', effectiveFrom: new Date('2026-01-01') },
          { dayOfWeek: 'WED', startTime: '17:00', endTime: '18:30', effectiveFrom: new Date('2026-01-01') },
        ],
      },
    },
  });

  const mmaClass = await prisma.class.create({
    data: {
      name: 'MMA Conditioning',
      discipline: 'MMA',
      skillLevel: 'INTERMEDIATE',
      capacity: 12,
      description: 'Mixed martial arts strength and conditioning',
      instructorId: instructor3.id,
      schoolId: school2.id,
      schedules: {
        create: [
          { dayOfWeek: 'TUE', startTime: '18:00', endTime: '19:00', effectiveFrom: new Date('2026-01-01') },
          { dayOfWeek: 'THU', startTime: '18:00', endTime: '19:00', effectiveFrom: new Date('2026-01-01') },
        ],
      },
    },
  });
  console.log(`  ✅ School 2 Classes: ${muayThaiClass.name}, ${mmaClass.name}`);

  // ─── Sessions & Check-ins ─────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // School 1 sessions
  const session1 = await prisma.classSession.create({
    data: {
      classId: karateClass.id,
      sessionDate: today,
      startTime: '18:00',
      endTime: '19:30',
      status: 'COMPLETED',
      qrCode: 'FLOW-SEED0001',
    },
  });

  const session2 = await prisma.classSession.create({
    data: {
      classId: bjjClass.id,
      sessionDate: today,
      startTime: '19:00',
      endTime: '20:30',
      status: 'SCHEDULED',
      qrCode: 'FLOW-SEED0002',
    },
  });

  // School 2 sessions
  const session3 = await prisma.classSession.create({
    data: {
      classId: muayThaiClass.id,
      sessionDate: today,
      startTime: '17:00',
      endTime: '18:30',
      status: 'COMPLETED',
      qrCode: 'FLOW-SEED0003',
    },
  });

  // Check-ins for School 1 karateClass session
  for (let i = 0; i < 3; i++) {
    await prisma.checkIn.create({
      data: {
        sessionId: session1.id,
        studentId: students[i].id,
        method: i === 0 ? 'ADMIN' : i === 1 ? 'KIOSK' : 'QR_CODE',
        checkedInBy: i === 0 ? owner1.id : null,
      },
    });
  }

  // Check-ins for School 2 muayThai session
  for (let i = 4; i < 6; i++) {
    await prisma.checkIn.create({
      data: {
        sessionId: session3.id,
        studentId: students[i].id,
        method: 'KIOSK',
      },
    });
  }
  console.log(`  ✅ Sample sessions and check-ins created`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('   Super Admin: admin@flowapp.com / admin123');
  console.log('   Owner 1:     owner@flowapp.com / owner123');
  console.log('   Owner 2:     owner2@flowapp.com / owner123');
  console.log('   Instructor:  sensei.mike@flowapp.com / instructor123');
  console.log('   Instructor:  coach.sarah@flowapp.com / instructor123');
  console.log('   Instructor:  coach.raj@flowapp.com / instructor123');
  console.log('   Student:     alex@example.com / student123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
