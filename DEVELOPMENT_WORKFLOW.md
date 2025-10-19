# Development Workflow Guide

## 🚀 Recommended Workflow for Nana Kick Development

Since localhost development in Whop iframe can be unreliable, use this **Vercel Preview Deployment** workflow instead.

---

## 📋 **Quick Change Workflow** (2-3 minutes per test)

### **For Small Fixes or Features:**

```bash
# 1. Create a dev branch
git checkout -b dev

# 2. Make your changes
# ... edit your files ...

# 3. Commit and push
git add .
git commit -m "Testing: [describe your change]"
git push origin dev

# 4. Wait 2-3 minutes for Vercel to build
# You'll get a preview URL like:
# https://nana-kick-git-dev-travisp-cyber.vercel.app
```

**Testing Your Changes:**

1. **Go to Vercel Dashboard** → Deployments
2. **Find your `dev` branch deployment**
3. **Click "Visit" to open the preview URL**
4. **Test directly** at: `https://nana-kick-git-dev-[your-name].vercel.app/experiences/exp_fehHSV6dBNPkkJ`
5. **Or test in Whop:**
   - Go to Whop Developer Dashboard → Your App → Settings
   - Temporarily change "Base URL" to your preview URL
   - Test in the Whop iframe
   - Change it back to production when done

---

## ✅ **When Changes Look Good:**

```bash
# Merge to main (deploys to production)
git checkout main
git pull origin main
git merge dev
git push origin main

# Or if you prefer, delete and start fresh:
git checkout main
git branch -D dev
```

---

## 🔄 **Continuous Development Workflow**

### **Option 1: Keep One Dev Branch** (Simpler)
```bash
# Day 1: Create dev branch
git checkout -b dev
# make changes, test, repeat...
git add .
git commit -m "WIP: testing feature"
git push origin dev

# Day 2: More changes
git add .
git commit -m "WIP: refining feature"
git push origin dev

# When ready for production:
git checkout main
git merge dev
git push origin main
```

### **Option 2: Feature Branches** (More Organized)
```bash
# For each new feature/fix:
git checkout main
git checkout -b feature/add-new-filter
# make changes...
git push origin feature/add-new-filter
# test preview URL
# merge when ready
git checkout main
git merge feature/add-new-filter
git push origin main
```

---

## 🎯 **Testing Checklist**

Before merging to production:

- [ ] Test the preview URL directly in browser
- [ ] Check console for errors (F12 → Console)
- [ ] Test core flows:
  - [ ] Image upload
  - [ ] Image edit with AI
  - [ ] Usage counter updates
  - [ ] Free trial flow (if applicable)
- [ ] Check mobile responsiveness (optional)
- [ ] Verify no broken links/images

---

## 🚨 **Emergency Rollback**

If you deploy something broken to production:

1. **Go to Vercel Dashboard** → Deployments
2. **Find the last working deployment**
3. **Click "⋯" (three dots)** → "Promote to Production"
4. **Done!** Users get the old version back instantly

---

## 📊 **Development vs Production**

| Environment | URL | Purpose | Users Affected? |
|-------------|-----|---------|----------------|
| **Local** | `http://localhost:3000` | Fast iteration | No |
| **Preview** | `https://nana-kick-git-dev-*.vercel.app` | Test before deploying | No |
| **Production** | `https://nana-kick.vercel.app` | Live app | Yes |

---

## 💡 **Pro Tips**

1. **Keep `dev` branch alive** - Don't delete it, reuse it for quick tests
2. **Check Vercel build logs** - If preview fails, check logs in Vercel dashboard
3. **Use descriptive commit messages** - Makes it easier to track what changed
4. **Test on preview before merging** - Catches issues before users see them

---

## 🔗 **Quick Links**

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Production App**: https://nana-kick.vercel.app
- **Health Check**: https://nana-kick.vercel.app/api/health
- **Whop Dashboard**: https://whop.com/dashboard/developer

---

## 🎓 **Example: Adding a New Feature**

```bash
# 1. Start fresh from main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/add-download-all-button

# 3. Make changes
# ... edit src/app/experiences/[experienceId]/page.tsx ...

# 4. Test
git add .
git commit -m "Add download all versions button"
git push origin feature/add-download-all-button

# 5. Wait for Vercel preview (2-3 min)
# 6. Test at preview URL
# 7. If good, merge to production:
git checkout main
git merge feature/add-download-all-button
git push origin main

# 8. Production deploys automatically!
```

---

**This workflow gives you the best of both worlds:**
- ✅ Fast testing (2-3 min deploys)
- ✅ Safe (doesn't affect live users)
- ✅ Reliable (works with Whop iframe)
- ✅ Easy rollback (one click in Vercel)


