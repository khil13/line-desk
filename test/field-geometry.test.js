const test = require("node:test");
const assert = require("node:assert/strict");
const { yardToX, ballYards, lineToGainYards } = require("../lib/field-geometry.js");

test("yardToX maps the 0-100 own-goal scale onto the 10-90 field band", () => {
  assert.equal(yardToX(0), 10);
  assert.equal(yardToX(100), 90);
  assert.equal(yardToX(50), 50);
});

test("yardToX clamps out-of-range input to the goal lines", () => {
  assert.equal(yardToX(-10), 10);
  assert.equal(yardToX(150), 90);
});

test("ballYards flips ESPN's yards-to-endzone into yards from the offense's own goal", () => {
  assert.equal(ballYards(75), 25);  // deep in their own territory
  assert.equal(ballYards(5), 95);   // knocking on the door
  assert.equal(ballYards(0), 100);  // touchdown
});

test("lineToGainYards adds the distance still needed, from the same origin", () => {
  assert.equal(lineToGainYards(75, 10), 35);
});

test("lineToGainYards clamps at the goal line on a goal-to-go situation", () => {
  assert.equal(lineToGainYards(5, 10), 100);
});

test("lineToGainYards ignores a negative or missing distance rather than pulling the marker backward", () => {
  assert.equal(lineToGainYards(75, -5), 25);
});
