/**
 * Wing Chun PostgreSQL Seed Script
 * Loads the Shaolin Wing Chun program data into PostgreSQL via Prisma.
 * 
 * Run: docker compose exec server node prisma/seed-wing-chun.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════
//  Belt Structure  (LV1 – LV10)
// ═══════════════════════════════════════════════════════

const BELTS = [
  { level: 1,  name: 'White',           color: '#FFFFFF', desc: 'Beginner — Foundation',                      monthsMin: 2,  monthsMax: 3  },
  { level: 2,  name: 'White/Yellow',    color: '#F5F5DC', desc: 'Transitional — Building Foundation',          monthsMin: 2,  monthsMax: 4  },
  { level: 3,  name: 'Yellow',          color: '#FFD700', desc: 'Early Intermediate — First Form Mastery',     monthsMin: 3,  monthsMax: 5  },
  { level: 4,  name: 'Orange/White',    color: '#FFA500', desc: 'Transitional — Bridge Building',              monthsMin: 4,  monthsMax: 6  },
  { level: 5,  name: 'Orange',          color: '#FF8C00', desc: 'Intermediate — Advanced Techniques',          monthsMin: 5,  monthsMax: 8  },
  { level: 6,  name: 'Blue',            color: '#4169E1', desc: 'Upper Intermediate — Second Form',            monthsMin: 6,  monthsMax: 10 },
  { level: 7,  name: 'Purple',          color: '#9370DB', desc: 'Advanced — Wooden Dummy Mastery',             monthsMin: 8,  monthsMax: 12 },
  { level: 8,  name: 'Green',           color: '#228B22', desc: 'Expert — Advanced Applications',              monthsMin: 10, monthsMax: 15 },
  { level: 9,  name: 'Brown',           color: '#8B4513', desc: 'Senior Expert — Teaching & Weapons',          monthsMin: 12, monthsMax: 18 },
  { level: 10, name: 'Black (1st Dan)', color: '#000000', desc: 'Master — Full Mastery & Leadership',          monthsMin: 18, monthsMax: 24 },
];

// ═══════════════════════════════════════════════════════
//  Age Categories
// ═══════════════════════════════════════════════════════

const AGE_CATEGORIES = ['Junior', 'Teen', 'Adult', 'Senior'];

// ═══════════════════════════════════════════════════════
//  Belt Requirements — indexed by level
// ═══════════════════════════════════════════════════════

const REQUIREMENTS = {
  1: {
    techniques: ['Horse Stance (Ma Bow)', 'Bow Stance (Gong Bow)', 'High Block (Upper Hou Sau)', 'Middle Block (Middle Gaun Sau)', 'Low Block (Lower Hou Sau)', 'Introduction to Siu Nim Tao Form'],
    attendance:     { Junior: 4,  Teen: 3,  Adult: 2,  Senior: 3  },
    timeInRank:     { Junior: 2,  Teen: 2,  Adult: 1,  Senior: 3  },
    teachingHours:  { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    sparring:       false,
    sparringMin:    { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'Why I want to learn Wing Chun', Teen: 'Wing Chun foundation — What makes it special?', Adult: 'What brings you to Wing Chun?', Senior: 'My journey to martial arts' },
  },
  2: {
    techniques: ['Jab Punch (Jing Quan)', 'Vertical Punch (Chuen Quan)', 'Palm Strike (Chang Geuk)', 'Simple Combinations', 'Siu Nim Tao (Level 1)', 'Chi Sau Foundation'],
    attendance:     { Junior: 8,  Teen: 6,  Adult: 4,  Senior: 6  },
    timeInRank:     { Junior: 2,  Teen: 2,  Adult: 1,  Senior: 3  },
    teachingHours:  { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    sparring:       false,
    sparringMin:    { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'My favorite technique and why', Teen: 'How punching works in Wing Chun', Adult: 'Understanding structure vs. strength', Senior: 'The importance of form and precision' },
  },
  3: {
    techniques: ['Siu Nim Tao (Level 2 Complete)', 'Chi Sau (Passive — 1 min)', 'Intermediate Blocks', 'Hand Traps (Gum Sau)', 'Basic Footwork', 'Light partner work'],
    attendance:     { Junior: 12, Teen: 10, Adult: 8,  Senior: 10 },
    timeInRank:     { Junior: 3,  Teen: 3,  Adult: 2,  Senior: 4  },
    teachingHours:  { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    sparring:       false,
    sparringMin:    { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'How blocking helps defense', Teen: 'The three forms of Wing Chun', Adult: 'Chi Sau: Sensitivity and structure', Senior: 'Learning through repetition' },
  },
  4: {
    techniques: ['Chi Sau (Controlled — 2 min)', 'Chum Kiu Form Introduction', 'Kick Blocks (Teuk Gaun)', 'Stepping Techniques', 'Light sparring introduction', 'Hand trap combinations'],
    attendance:     { Junior: 16, Teen: 14, Adult: 12, Senior: 14 },
    timeInRank:     { Junior: 4,  Teen: 4,  Adult: 3,  Senior: 5  },
    teachingHours:  { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    sparring:       true,
    sparringMin:    { Junior: 1,  Teen: 3,  Adult: 5,  Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'Wing Chun philosophy: Why is patience important?', Teen: 'How does Chi Sau prepare us for real combat?', Adult: 'Analyzing footwork in real-world application', Senior: 'What does Wing Chun teach us about aging gracefully?' },
  },
  5: {
    techniques: ['Chum Kiu (Level 1)', 'Active Chi Sau (3 min)', 'Intermediate Sparring', 'Wooden Dummy Basics', 'Footwork Patterns', 'Hand traps mastery'],
    attendance:     { Junior: 20, Teen: 18, Adult: 16, Senior: 18 },
    timeInRank:     { Junior: 5,  Teen: 5,  Adult: 4,  Senior: 6  },
    teachingHours:  { Junior: 0,  Teen: 0,  Adult: 0,  Senior: 0  },
    sparring:       true,
    sparringMin:    { Junior: 3,  Teen: 5,  Adult: 8,  Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'How does footwork connect everything?', Teen: 'Analyze a weakness in your sparring', Adult: 'How does structure defeat strength?', Senior: 'My personal health journey with martial arts' },
  },
  6: {
    techniques: ['Chum Kiu (Full Form)', 'Biu Jee Introduction', 'Chi Sau Mastery', 'Wooden Dummy (Sections 1-3)', 'Advanced Sparring Techniques', 'Footwork with applications'],
    attendance:     { Junior: 28, Teen: 24, Adult: 20, Senior: 24 },
    timeInRank:     { Junior: 6,  Teen: 6,  Adult: 5,  Senior: 8  },
    teachingHours:  { Junior: 0,  Teen: 4,  Adult: 8,  Senior: 4  },
    sparring:       true,
    sparringMin:    { Junior: 5,  Teen: 8,  Adult: 10, Senior: 0  },
    weapons:        false,
    weaponsSkill:   '',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'Wing Chun and other martial arts', Teen: 'The difference between power and structure', Adult: 'Teaching methodology: Breaking down techniques', Senior: 'How to live the Wing Chun philosophy daily' },
  },
  7: {
    techniques: ['Biu Jee (Level 1)', 'Butterfly Knife Introduction', 'Wooden Dummy (Complete Set)', 'Chi Sau at high levels', 'Competition-level Sparring', 'Strategic Applications'],
    attendance:     { Junior: 36, Teen: 30, Adult: 24, Senior: 28 },
    timeInRank:     { Junior: 8,  Teen: 8,  Adult: 7,  Senior: 10 },
    teachingHours:  { Junior: 4,  Teen: 8,  Adult: 10, Senior: 6  },
    sparring:       true,
    sparringMin:    { Junior: 8,  Teen: 10, Adult: 12, Senior: 0  },
    weapons:        true,
    weaponsSkill:   'Butterfly Knives (Basic Forms)',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'How would you teach a beginner?', Teen: 'Compare Wing Chun techniques across forms', Adult: 'Building a sustainable martial arts business', Senior: 'Wisdom to pass down: Martial arts and life lessons' },
  },
  8: {
    techniques: ['Biu Jee (Full Form)', 'Butterfly Knives (Forms)', 'Long Pole Introduction', 'All Chi Sau Variations', 'Tournament-level Sparring', 'Emergency Response Applications'],
    attendance:     { Junior: 48, Teen: 42, Adult: 32, Senior: 32 },
    timeInRank:     { Junior: 10, Teen: 10, Adult: 9,  Senior: 12 },
    teachingHours:  { Junior: 8,  Teen: 16, Adult: 20, Senior: 12 },
    sparring:       true,
    sparringMin:    { Junior: 10, Teen: 15, Adult: 15, Senior: 0  },
    weapons:        true,
    weaponsSkill:   'Butterfly Knives (Full Forms) & Long Pole (Basics)',
    tournament:     0,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'Advanced Wing Chun applications', Teen: 'Leading by example in training', Adult: 'Advanced applications of Biu Jee principles', Senior: 'Teaching the next generation' },
  },
  9: {
    techniques: ['All Three Forms Mastery', 'Butterfly Knives (Full)', 'Long Pole (Full Form)', 'Advanced Chi Sau Combinations', 'Tournament wins (2+)', 'Curriculum Development'],
    attendance:     { Junior: 60, Teen: 54, Adult: 40, Senior: 40 },
    timeInRank:     { Junior: 12, Teen: 12, Adult: 12, Senior: 14 },
    teachingHours:  { Junior: 16, Teen: 32, Adult: 40, Senior: 20 },
    sparring:       true,
    sparringMin:    { Junior: 15, Teen: 20, Adult: 20, Senior: 0  },
    weapons:        true,
    weaponsSkill:   'All Weapons Mastery',
    tournament:     2,
    curriculumDev:  false,
    essay:          true,
    essayPrompt:    { Junior: 'My Wing Chun journey so far', Teen: 'How to create an effective training program', Adult: 'Your philosophy of Wing Chun and legacy', Senior: 'Passing knowledge to younger generations' },
  },
  10: {
    techniques: ['Complete System Mastery', 'All Forms at Master Level', 'All Weapons at Expert Level', 'Advanced Applications Library', 'Tournament Competition (3+)', 'Sifu-Level Understanding'],
    attendance:     { Junior: 100, Teen: 100, Adult: 80, Senior: 60 },
    timeInRank:     { Junior: 18,  Teen: 18,  Adult: 18, Senior: 18 },
    teachingHours:  { Junior: 32,  Teen: 64,  Adult: 80, Senior: 40 },
    sparring:       true,
    sparringMin:    { Junior: 20,  Teen: 25,  Adult: 25, Senior: 0  },
    weapons:        true,
    weaponsSkill:   'Complete Weapon Systems Mastery',
    tournament:     3,
    curriculumDev:  true,
    essay:          true,
    essayPrompt:    { Junior: 'What does it mean to be a Black Belt?', Teen: 'My vision for Wing Chun', Adult: 'Thesis: Wing Chun Philosophy and Practice', Senior: 'Legacy and Wisdom' },
  },
};

// ═══════════════════════════════════════════════════════
//  Curriculum Items
// ═══════════════════════════════════════════════════════

const CURRICULUM = [
  // ── Stances ──────────────────────────────────────────
  { id: 'horse_stance',     name: 'Horse Stance (Ma Bow)',              category: 'Stances',              technique: 'Stance',          difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'The foundational stable stance in Wing Chun' },
  { id: 'bow_stance',       name: 'Bow Stance (Gong Bow)',              category: 'Stances',              technique: 'Stance',          difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'Forward-facing stance for movement and power' },

  // ── Defensive ────────────────────────────────────────
  { id: 'high_block',       name: 'High Block (Upper Hou Sau)',         category: 'Defensive Techniques', technique: 'Block',           difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'Blocks for high-level attacks' },
  { id: 'gaun_sau',         name: 'Centerline Block (Gaun Sau)',        category: 'Defensive Techniques', technique: 'Block',           difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'Middle block protecting the centerline' },
  { id: 'low_block',        name: 'Low Block (Lower Hou Sau)',          category: 'Defensive Techniques', technique: 'Block',           difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'Blocks for low-level attacks and kicks' },

  // ── Strikes ──────────────────────────────────────────
  { id: 'jing_quan',        name: 'Jab Punch (Jing Quan)',              category: 'Striking Techniques',  technique: 'Punch',           difficulty: 'Beginner',     minLevel: 2,  ages: ['Junior','Teen','Adult'],          desc: 'Quick straight punch from ready position' },
  { id: 'chuen_quan',       name: 'Vertical Punch (Chuen Quan)',        category: 'Striking Techniques',  technique: 'Punch',           difficulty: 'Beginner',     minLevel: 2,  ages: ['Junior','Teen','Adult'],          desc: 'Punch with palm facing inward for power' },
  { id: 'palm_strike',      name: 'Palm Strike (Chang Geuk)',           category: 'Striking Techniques',  technique: 'Strike',          difficulty: 'Beginner',     minLevel: 2,  ages: ['Junior','Teen','Adult','Senior'], desc: 'Strike using open palm for broad impact' },

  // ── Forms ────────────────────────────────────────────
  { id: 'siu_nim_tao',      name: 'Siu Nim Tao (Little Idea Form)',     category: 'Forms',                technique: 'Form',            difficulty: 'Beginner',     minLevel: 1,  ages: ['Junior','Teen','Adult','Senior'], desc: 'The fundamental form teaching all basic techniques' },
  { id: 'chum_kiu',         name: 'Chum Kiu (Bridging the Gap Form)',   category: 'Forms',                technique: 'Form',            difficulty: 'Intermediate', minLevel: 4,  ages: ['Junior','Teen','Adult'],          desc: 'Bridges the gap between solo form and partner work' },
  { id: 'biu_jee',          name: 'Biu Jee (Thrusting Fingers Form)',   category: 'Forms',                technique: 'Form',            difficulty: 'Advanced',     minLevel: 6,  ages: ['Teen','Adult'],                  desc: 'Emergency recovery techniques and thrusting applications' },

  // ── Partner Drills ───────────────────────────────────
  { id: 'chi_sau',          name: 'Chi Sau (Sticky Hands)',             category: 'Partner Drills',       technique: 'Partner Drill',   difficulty: 'Intermediate', minLevel: 2,  ages: ['Junior','Teen','Adult'],          desc: 'Sensitivity and reflexive training with a partner' },
  { id: 'hand_traps',       name: 'Hand Traps (Gum Sau)',              category: 'Partner Drills',       technique: 'Partner Drill',   difficulty: 'Intermediate', minLevel: 4,  ages: ['Junior','Teen','Adult'],          desc: "Control opponent's hands while launching counterattacks" },

  // ── Equipment ────────────────────────────────────────
  { id: 'wooden_dummy',     name: 'Wooden Dummy (Muk Yan Jong)',        category: 'Equipment Drills',     technique: 'Equipment Drill', difficulty: 'Intermediate', minLevel: 5,  ages: ['Junior','Teen','Adult'],          desc: 'Practice techniques against the traditional wooden dummy' },

  // ── Weapons ──────────────────────────────────────────
  { id: 'butterfly_knives', name: 'Butterfly Knives (Baat Jaam Dao)',   category: 'Weapons',              technique: 'Weapon',          difficulty: 'Advanced',     minLevel: 7,  ages: ['Teen','Adult'],                  desc: 'Double knife forms and applications' },
  { id: 'long_pole',        name: 'Long Pole (Luk Dim Boon Gwun)',     category: 'Weapons',              technique: 'Weapon',          difficulty: 'Advanced',     minLevel: 8,  ages: ['Teen','Adult'],                  desc: 'Staff techniques and advanced applications' },
];


async function main() {
  console.log('🥋 Seeding Wing Chun Program Data...\n');

  // ─── 1. Create Program ────────────────────────────────
  const program = await prisma.program.upsert({
    where: { id: 'shaolin-wing-chun' },
    update: {
      name: 'Shaolin Wing Chun',
      description: 'Traditional 10-level Shaolin Wing Chun program with belts from White to Black (1st Dan). Covers all three forms, weapons, Chi Sau, and teaching progression.',
      isGlobal: true,
      hasRankStructure: true,
      isActive: true,
    },
    create: {
      id: 'shaolin-wing-chun',
      name: 'Shaolin Wing Chun',
      description: 'Traditional 10-level Shaolin Wing Chun program with belts from White to Black (1st Dan). Covers all three forms, weapons, Chi Sau, and teaching progression.',
      isGlobal: true,
      hasRankStructure: true,
      isActive: true,
    },
  });
  console.log(`  ✅ Program: ${program.name} (${program.id})`);

  // ─── 2. Create Belts ──────────────────────────────────
  console.log('\n  📍 Creating Belts...');
  const beltMap = {};
  
  for (const belt of BELTS) {
    const beltId = `wc-belt-${belt.level}`;
    const created = await prisma.belt.upsert({
      where: { id: beltId },
      update: {
        name: belt.name,
        displayOrder: belt.level,
        color: belt.color,
        description: belt.desc,
      },
      create: {
        id: beltId,
        programId: program.id,
        name: belt.name,
        displayOrder: belt.level,
        color: belt.color,
        description: belt.desc,
      },
    });
    beltMap[belt.level] = created;
    console.log(`     Level ${belt.level}: ${belt.name} (${belt.color})`);
  }

  // ─── 3. Create Belt Requirements ──────────────────────
  console.log('\n  📋 Creating Belt Requirements...');
  let reqCount = 0;

  for (const [levelStr, req] of Object.entries(REQUIREMENTS)) {
    const level = parseInt(levelStr, 10);
    const belt = beltMap[level];
    if (!belt) continue;

    // Techniques (TECHNIQUE)
    for (const technique of req.techniques) {
      await prisma.beltRequirement.upsert({
        where: { id: `wc-req-${level}-tech-${technique.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}` },
        update: { description: technique },
        create: {
          id: `wc-req-${level}-tech-${technique.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
          beltId: belt.id,
          type: 'TECHNIQUE',
          description: technique,
          isRequired: true,
        },
      });
      reqCount++;
    }

    // Attendance (MIN_ATTENDANCE) - one per age category
    for (const age of AGE_CATEGORIES) {
      const classes = req.attendance[age];
      if (classes > 0) {
        await prisma.beltRequirement.upsert({
          where: { id: `wc-req-${level}-att-${age.toLowerCase()}` },
          update: { description: `Minimum ${classes} classes attended (${age})`, value: classes },
          create: {
            id: `wc-req-${level}-att-${age.toLowerCase()}`,
            beltId: belt.id,
            type: 'MIN_ATTENDANCE',
            description: `Minimum ${classes} classes attended (${age})`,
            value: classes,
            isRequired: true,
          },
        });
        reqCount++;
      }
    }

    // Time in Rank (TIME_IN_RANK) - one per age category
    for (const age of AGE_CATEGORIES) {
      const months = req.timeInRank[age];
      if (months > 0) {
        await prisma.beltRequirement.upsert({
          where: { id: `wc-req-${level}-tir-${age.toLowerCase()}` },
          update: { description: `Minimum ${months} months at current rank (${age})`, value: months },
          create: {
            id: `wc-req-${level}-tir-${age.toLowerCase()}`,
            beltId: belt.id,
            type: 'TIME_IN_RANK',
            description: `Minimum ${months} months at current rank (${age})`,
            value: months,
            isRequired: true,
          },
        });
        reqCount++;
      }
    }

    // Essay (ESSAY) - one per age category with prompt
    if (req.essay) {
      for (const age of AGE_CATEGORIES) {
        const prompt = req.essayPrompt[age];
        if (prompt) {
          await prisma.beltRequirement.upsert({
            where: { id: `wc-req-${level}-essay-${age.toLowerCase()}` },
            update: { description: `Essay (${age}): ${prompt}` },
            create: {
              id: `wc-req-${level}-essay-${age.toLowerCase()}`,
              beltId: belt.id,
              type: 'ESSAY',
              description: `Essay (${age}): ${prompt}`,
              isRequired: true,
            },
          });
          reqCount++;
        }
      }
    }

    // Sparring (CUSTOM)
    if (req.sparring) {
      for (const age of AGE_CATEGORIES) {
        const rounds = req.sparringMin[age];
        if (rounds > 0) {
          await prisma.beltRequirement.upsert({
            where: { id: `wc-req-${level}-spar-${age.toLowerCase()}` },
            update: { description: `Sparring: ${rounds} rounds minimum (${age})`, value: rounds },
            create: {
              id: `wc-req-${level}-spar-${age.toLowerCase()}`,
              beltId: belt.id,
              type: 'CUSTOM',
              description: `Sparring: ${rounds} rounds minimum (${age})`,
              value: rounds,
              isRequired: true,
            },
          });
          reqCount++;
        }
      }
    }

    // Teaching Hours (CUSTOM)
    for (const age of AGE_CATEGORIES) {
      const hours = req.teachingHours[age];
      if (hours > 0) {
        await prisma.beltRequirement.upsert({
          where: { id: `wc-req-${level}-teach-${age.toLowerCase()}` },
          update: { description: `Teaching: ${hours} hours assisting classes (${age})`, value: hours },
          create: {
            id: `wc-req-${level}-teach-${age.toLowerCase()}`,
            beltId: belt.id,
            type: 'CUSTOM',
            description: `Teaching: ${hours} hours assisting classes (${age})`,
            value: hours,
            isRequired: true,
          },
        });
        reqCount++;
      }
    }

    // Weapons (CUSTOM)
    if (req.weapons && req.weaponsSkill) {
      await prisma.beltRequirement.upsert({
        where: { id: `wc-req-${level}-weapons` },
        update: { description: `Weapons: ${req.weaponsSkill}` },
        create: {
          id: `wc-req-${level}-weapons`,
          beltId: belt.id,
          type: 'CUSTOM',
          description: `Weapons: ${req.weaponsSkill}`,
          isRequired: true,
        },
      });
      reqCount++;
    }

    // Tournament (CUSTOM)
    if (req.tournament > 0) {
      await prisma.beltRequirement.upsert({
        where: { id: `wc-req-${level}-tournament` },
        update: { description: `Tournament: ${req.tournament} competition(s) minimum`, value: req.tournament },
        create: {
          id: `wc-req-${level}-tournament`,
          beltId: belt.id,
          type: 'CUSTOM',
          description: `Tournament: ${req.tournament} competition(s) minimum`,
          value: req.tournament,
          isRequired: true,
        },
      });
      reqCount++;
    }

    // Curriculum Development (CUSTOM)
    if (req.curriculumDev) {
      await prisma.beltRequirement.upsert({
        where: { id: `wc-req-${level}-curriculum` },
        update: { description: 'Curriculum Development: Create teaching materials' },
        create: {
          id: `wc-req-${level}-curriculum`,
          beltId: belt.id,
          type: 'CUSTOM',
          description: 'Curriculum Development: Create teaching materials',
          isRequired: true,
        },
      });
      reqCount++;
    }
  }
  console.log(`     Created ${reqCount} belt requirements`);

  // ─── 4. Create Curriculum Items ───────────────────────
  console.log('\n  📚 Creating Curriculum Items...');
  
  for (const item of CURRICULUM) {
    const belt = beltMap[item.minLevel];
    await prisma.curriculumItem.upsert({
      where: { id: `wc-curriculum-${item.id}` },
      update: {
        title: item.name,
        description: item.desc,
        category: item.category,
        sortOrder: item.minLevel,
      },
      create: {
        id: `wc-curriculum-${item.id}`,
        programId: program.id,
        beltId: belt?.id || null,
        title: item.name,
        description: item.desc,
        category: item.category,
        sortOrder: item.minLevel,
        isPublic: true,
      },
    });
    console.log(`     ${item.category}: ${item.name}`);
  }

  console.log('\n✅ Wing Chun curriculum seeding complete!');
  console.log(`   • 1 Program`);
  console.log(`   • ${BELTS.length} Belts`);
  console.log(`   • ${reqCount} Belt Requirements`);
  console.log(`   • ${CURRICULUM.length} Curriculum Items`);

  // ─── 5. Create Program Offerings for All Schools ───────
  console.log('\n  🏫 Creating Wing Chun Program Offerings for Schools...');
  
  const schools = await prisma.school.findMany({ where: { isActive: true } });
  let offeringCount = 0;
  
  for (const school of schools) {
    // Check if this school already has a Wing Chun offering
    const existingOffering = await prisma.class.findFirst({
      where: {
        schoolId: school.id,
        programId: program.id,
      },
    });
    
    if (!existingOffering) {
      // Find an instructor at this school (if any)
      const instructor = await prisma.user.findFirst({
        where: {
          schoolId: school.id,
          role: 'INSTRUCTOR',
          isActive: true,
        },
      });

      await prisma.class.create({
        data: {
          name: 'Wing Chun',
          programId: program.id,
          schoolId: school.id,
          instructorId: instructor?.id || null,
          skillLevel: 'ALL_LEVELS',
          capacity: 20,
          description: 'Traditional Shaolin Wing Chun program covering all levels from White to Black belt.',
          isActive: true,
        },
      });
      offeringCount++;
      console.log(`     ✅ ${school.name}: Wing Chun offering created`);
    } else {
      console.log(`     ⏭️  ${school.name}: Already has Wing Chun offering`);
    }
  }
  
  console.log(`\n  Created ${offeringCount} new program offerings`);
  console.log('\n✅ Wing Chun seeding fully complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
