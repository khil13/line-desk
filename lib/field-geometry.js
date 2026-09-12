/* Pure geometry for the live field diagram: converts ESPN's situation data
   (yardsToEndzone, distance) into positions on a 0-100-wide SVG viewBox
   where 0-10 is the offense's own end zone, 10-90 is the 100-yard field
   compressed to 80 units, and 90-100 is the end zone they're driving
   toward. The offense always runs left to right in this coordinate space,
   regardless of which real end zone they're actually facing. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.FieldGeometry = mod;
})(typeof self !== "undefined" ? self : this, function () {

const yardToX = (yardsFromOwnGoal) => {
  const y = Math.max(0, Math.min(100, yardsFromOwnGoal));
  return 10 + y * 0.8;
};

// ESPN's yardsToEndzone is how far the offense still has to go to score.
// Flipped, that's how far they've already come from their own goal line.
const ballYards = (yardsToEndzone) => 100 - yardsToEndzone;

// Where the first-down marker sits, in the same 0-100 own-goal-relative
// scale, clamped at the goal line for a goal-to-go situation.
const lineToGainYards = (yardsToEndzone, distance) =>
  Math.min(100, ballYards(yardsToEndzone) + Math.max(0, distance));

return { yardToX, ballYards, lineToGainYards };

});
