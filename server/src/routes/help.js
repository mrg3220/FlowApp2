const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/helpController');

router.use(authenticate);

// Articles
router.get('/articles', c.getArticles);
router.get('/articles/categories', c.getCategories);
router.get('/articles/:id', c.getArticle);
router.post('/articles', authorize('SUPER_ADMIN', 'MARKETING'), c.createArticle);
router.put('/articles/:id', authorize('SUPER_ADMIN', 'MARKETING'), c.updateArticle);
router.delete('/articles/:id', authorize('SUPER_ADMIN', 'MARKETING'), c.deleteArticle);

// Onboarding
router.get('/onboarding', c.getOnboardingProgress);
router.post('/onboarding', c.completeOnboardingStep);

// AI Chat
router.post('/chat', c.aiChat);

module.exports = router;
