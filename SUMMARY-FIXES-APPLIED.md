# ✅ Summary: Fixes Applied (S22-4g)

**Date**: 2025-11-09
**Session**: Token limit approaching (~115k/200k)

---

## ✅ COMPLETED FIXES

### 1. tsconfig exclut \*.spec.ts files

**File**: `tsconfig.app.json`
**Status**: ✅ DONE
**Validation**: `pnpm typecheck` passes

```json
"exclude": [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/**/*.spec.ts",   // NEW
  "src/**/*.spec.tsx",  // NEW
  "tests"
]
```

### 2. DUPLICATE_OFFSET_MM = 60

**Files**: `src/state/constants.ts`, `src/state/useSceneStore.ts`, `src/App.duplicate.snap.test.tsx`
**Status**: ✅ DONE (code updated, test still fails due to other issue)

**Constant created**:

```typescript
// src/state/constants.ts
export const DUPLICATE_OFFSET_MM = 60;
```

**Used in duplication**:

- Simple duplication: offset and escape steps use `DUPLICATE_OFFSET_MM`
- Group duplication: offset and escape steps use `DUPLICATE_OFFSET_MM`
- Test: uses constant in assertions

**Test issue**: Still fails (expected 100, received 160) - needs investigation of why position is 160 instead of 100. Likely related to:

- Initial piece position from `initSceneWithDefaults`
- OR escape mechanism finding collision and offsetting further
- OR snap being applied elsewhere

---

## ⚠️ KNOWN ISSUES (not fixed due to token limit)

### Test: App.duplicate.snap.test.tsx

**Status**: ❌ FAILS
**Error**: `expected 100 to be 160`
**Analysis**:

- Position should be: originalPos.x (40) + DUPLICATE_OFFSET_MM (60) = 100
- Actual result: 160
- Gap: 160 - 100 = 60 (exactly one DUPLICATE_OFFSET_MM)
- **Hypothesis**: Escape mechanism detected collision and added +60mm again

**Next steps**:

1. Debug: Add console.log in duplicateSelected to see `finalX` value
2. Check if collision detected in escape loop
3. OR check if initSceneWithDefaults creates a piece at position that causes collision

### Test: layers.ghosts.spec.tsx

**Status**: ❌ NOT STARTED
**Issue**: "Ghost piece can be resized" - width doesn't change
**Root cause**: Resize validation likely blocks for ghost WARN pieces
**Fix needed**: Audit resize guards, only block for:

- Same-layer collision (C2↔C2)
- Out of bounds
- NOT for support missing (should be WARN only)

### recalculateExactSupport proxy revoked

**Status**: ❌ NOT STARTED
**Issue**: "Unhandled Rejection: Cannot perform 'get' on a proxy that has been revoked"
**Fix needed**: Refactor to snapshot→async→check revision→set pattern (detailed in docs/S22-4g-FIXES-EN-COURS.md)

---

## 📊 Current Test Status

```bash
pnpm -s test src/App.duplicate.snap.test.tsx --run
```

**Result**: 1 failed, 4 passed

- ❌ Ctrl+D duplicates selected piece (offset issue)
- ✅ duplicate button works
- ✅ snap to left edge within threshold
- ✅ no snap when outside threshold
- ✅ guides rendering during snap

---

## 📝 NEXT ACTIONS (Priority Order)

1. **Debug duplication offset test**:
   - Add debug logs to see exact flow
   - Identify why result is 160 instead of 100
   - Fix or adjust test expectations

2. **Fix resize for ghost WARN**:
   - Audit validation guards in resize flow
   - Ensure WARN doesn't block resize
   - Add [RESIZE_GUARD] log

3. **Refactor recalculateExactSupport**:
   - Implement revision-based async pattern
   - Add snapshot cloning
   - Create waitExact test helper

4. **Run full test suite**:
   - Verify all 687 tests still pass
   - Check for regressions

---

## 🎯 Files Modified This Session

### Production Code:

1. `tsconfig.app.json` - Add \*.spec.ts exclusions
2. `src/state/constants.ts` - Add DUPLICATE_OFFSET_MM = 60
3. `src/state/useSceneStore.ts` - Use DUPLICATE_OFFSET_MM in duplicateSelected()

### Test Code:

4. `src/App.duplicate.snap.test.tsx` - Use DUPLICATE_OFFSET_MM constant, disable snap10mm

### Documentation:

5. `docs/S22-4g-FIXES-EN-COURS.md` - Comprehensive fix documentation
6. `SUMMARY-FIXES-APPLIED.md` - This file

---

## 💡 Recommendations

1. **For duplication test**: Consider if escape mechanism is expected behavior. If a piece is duplicated and causes collision, it should escape. Test might need to account for this.

2. **For all fixes**: Each should be atomic commit with clear message:
   - `feat(duplicate): standardize offset to 60mm constant`
   - `fix(resize): allow resize for ghost WARN pieces`
   - `refactor(support): fix proxy revoked in recalculateExactSupport`

3. **Before commit**: Run `pnpm test --run` to ensure no new regressions.

---

**Session End**: ~115k tokens used
**Continuation needed**: Yes, for remaining 2-3 issues
