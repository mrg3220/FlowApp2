const prisma = require('../config/database');

// ─── Help Articles ───────────────────────────────────────

const getArticles = async (req, res, next) => {
  try {
    const { category, search, role } = req.query;
    const where = { isPublished: true };
    if (category) where.category = category;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];

    let articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Filter by role if specified
    const userRole = role || req.user?.role;
    if (userRole) {
      articles = articles.filter(
        (a) => a.roles.length === 0 || a.roles.includes(userRole)
      );
    }

    res.json(articles);
  } catch (error) { next(error); }
};

const getArticle = async (req, res, next) => {
  try {
    const article = await prisma.helpArticle.findUnique({ where: { id: req.params.id } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) { next(error); }
};

const getCategories = async (req, res, next) => {
  try {
    const articles = await prisma.helpArticle.findMany({
      where: { isPublished: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    res.json(articles.map((a) => a.category));
  } catch (error) { next(error); }
};

const createArticle = async (req, res, next) => {
  try {
    const article = await prisma.helpArticle.create({ data: req.body });
    res.status(201).json(article);
  } catch (error) { next(error); }
};

const updateArticle = async (req, res, next) => {
  try {
    const article = await prisma.helpArticle.update({ where: { id: req.params.id }, data: req.body });
    res.json(article);
  } catch (error) { next(error); }
};

const deleteArticle = async (req, res, next) => {
  try {
    await prisma.helpArticle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Article deleted' });
  } catch (error) { next(error); }
};

// ─── Onboarding Progress ─────────────────────────────────

const getOnboardingProgress = async (req, res, next) => {
  try {
    const progress = await prisma.onboardingProgress.findMany({
      where: { userId: req.user.id },
      orderBy: { completedAt: 'asc' },
    });
    res.json(progress);
  } catch (error) { next(error); }
};

const completeOnboardingStep = async (req, res, next) => {
  try {
    const step = await prisma.onboardingProgress.upsert({
      where: { userId_stepKey: { userId: req.user.id, stepKey: req.body.stepKey } },
      update: {},
      create: { userId: req.user.id, stepKey: req.body.stepKey },
    });
    res.json(step);
  } catch (error) { next(error); }
};

// ─── AI Chat (optional OpenAI) ───────────────────────────

const aiChat = async (req, res, next) => {
  try {
    const { message, conversationHistory } = req.body;

    // Built-in contextual help first
    const helpResults = await prisma.helpArticle.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: message, mode: 'insensitive' } },
          { content: { contains: message, mode: 'insensitive' } },
          { tags: { hasSome: message.toLowerCase().split(' ').filter((w) => w.length > 3) } },
        ],
      },
      take: 3,
    });

    // If OpenAI key configured, use it
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const context = helpResults.map((a) => `[${a.title}]: ${a.content.substring(0, 300)}`).join('\n');
        const messages = [
          {
            role: 'system',
            content: `You are the FlowApp martial arts management assistant. You help users with the application. User role: ${req.user.role}. Title: ${req.user.title || 'NONE'}.\n\nRelevant help articles:\n${context}\n\nBe concise and helpful. If you don't know, suggest checking the Help Center.`,
          },
          ...(conversationHistory || []),
          { role: 'user', content: message },
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages, max_tokens: 500, temperature: 0.7 }),
        });

        if (response.ok) {
          const data = await response.json();
          return res.json({
            reply: data.choices[0].message.content,
            source: 'ai',
            relatedArticles: helpResults.map((a) => ({ id: a.id, title: a.title, category: a.category })),
          });
        }
      } catch (aiError) {
        console.error('OpenAI API error:', aiError.message);
      }
    }

    // Fallback to built-in help
    if (helpResults.length > 0) {
      const bestMatch = helpResults[0];
      return res.json({
        reply: `Here's what I found:\n\n**${bestMatch.title}**\n${bestMatch.content.substring(0, 500)}${bestMatch.content.length > 500 ? '...' : ''}`,
        source: 'help_articles',
        relatedArticles: helpResults.map((a) => ({ id: a.id, title: a.title, category: a.category })),
      });
    }

    res.json({
      reply: "I'm not sure about that. Try browsing the Help Center by category, or contact your school administrator for assistance.",
      source: 'fallback',
      relatedArticles: [],
    });
  } catch (error) { next(error); }
};

module.exports = {
  getArticles, getArticle, getCategories, createArticle, updateArticle, deleteArticle,
  getOnboardingProgress, completeOnboardingStep, aiChat,
};
