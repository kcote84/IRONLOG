import { test, expect } from "@playwright/test";
import { freshData, validateData, toKg, fromKg, isPr } from "../src/model.js";

test("le format refuse les références brisées sans modifier la source", () => {
  const data = freshData();
  data.sets.push({
    id: "s",
    exerciseId: "missing",
    workoutId: "missing",
    weightKg: 100,
    reps: 5,
    createdAt: new Date().toISOString(),
  });
  expect(() => validateData(data)).toThrow("Références");
  expect(data.sets).toHaveLength(1);
});

test("les unités et le record restent cohérents", () => {
  expect(fromKg(toKg(225, "lb"), "lb")).toBeCloseTo(225);
  expect(isPr({ weightKg: 100, reps: 8 }, [{ weightKg: 100, reps: 7 }])).toBe(
    true,
  );
  expect(isPr({ weightKg: 95, reps: 12 }, [{ weightKg: 100, reps: 7 }])).toBe(
    false,
  );
});
