const fs = require('fs');
const mathjs = require('mathjs');

const epsilon = 1e-9;
const infinity = 1e10;
const minTarget = 0;
const maxTarget = 100;

function calc(numbers) {
  const n = numbers.length;
  const dp = [[]];
  for (let mask = 1; mask < (1 << n); ++mask) {
    let bits = [];
    for (let i = 0; i < n; ++i) {
      if (mask & (1 << i)) {
        bits.push(i);
      }
    }

    if (bits.length === 1) {
      dp[mask] = [{
        value: numbers[bits[0]],
        expr: `${numbers[bits[0]]}`,
        last: '',
      }];
    } else {
      const solutions = {};

      for (let mask1 = 1; mask1 < (1 << n); ++mask1) {
        if (!((mask1 & mask) === mask1 && mask1 !== mask)) continue;
        const mask2 = mask ^ mask1;
        if (!dp[mask1] || !dp[mask2]) continue;

        for (let i = 0; i < dp[mask1].length; ++i) {
          for (let j = 0; j < dp[mask2].length; ++j) {
            const dp1 = dp[mask1][i];
            const dp2 = dp[mask2][j];

            let possibilities = [
              // Addition
              {
                value: dp1.value + dp2.value,
                expr: `${dp1.expr} + ${dp2.expr}`,
                last: '+-',
              },
              // Subtraction
              {
                value: dp1.value - dp2.value,
                expr: dp2.last === '+-' ? `${dp1.expr} - (${dp2.expr})` : `${dp1.expr} - ${dp2.expr}`,
                last: '+-',
              },
              {
                value: dp2.value - dp1.value,
                expr: dp1.last === '+-' ? `${dp2.expr} - (${dp1.expr})` : `${dp2.expr} - ${dp1.expr}`,
                last: '+-',
              },
              // Multiplication
              {
                value: dp1.value * dp2.value,
                expr: `${dp1.last === '+-' ? `(${dp1.expr})` : dp1.expr} * ${dp2.last === '+-' ? `(${dp2.expr})` : dp2.expr}`,
                last: '*/',
              }
            ];
            // Division
            if (Math.abs(dp1.value) > epsilon) {
              possibilities.push({
                value: dp2.value / dp1.value,
                expr: `${dp2.last === '+-' ? `(${dp2.expr})` : dp2.expr} / ${dp1.last ? `(${dp1.expr})` : dp1.expr}`,
                last: '*/',
              });
            }
            if (Math.abs(dp2.value) > epsilon) {
              possibilities.push({
                value: dp1.value / dp2.value,
                expr: `${dp1.last === '+-' ? `(${dp1.expr})` : dp1.expr} / ${dp2.last ? `(${dp2.expr})` : dp2.expr}`,
                last: '*/',
              });
            }
            // Power
            if (!(Math.abs(dp1.value) < epsilon && Math.abs(dp2.value) < epsilon)) {
              let v = Math.pow(dp1.value, dp2.value);
              if (Math.abs(v) < infinity && Math.abs(v) > epsilon) {
                possibilities.push({
                  value: Math.pow(dp1.value, dp2.value),
                  expr: `${dp1.last ? `(${dp1.expr})` : dp1.expr} ^ ${dp2.last ? `(${dp2.expr})` : dp2.expr}`,
                  last: '^',
                });
              }
              v = Math.pow(dp2.value, dp1.value);
              if (Math.abs(v) < infinity && Math.abs(v) > epsilon) {
                possibilities.push({
                  value: Math.pow(dp2.value, dp1.value),
                  expr: `${dp2.last ? `(${dp2.expr})` : dp2.expr} ^ ${dp1.last ? `(${dp1.expr})` : dp1.expr}`,
                  last: '^',
                });
              }
            }

            for (const possibility of possibilities) {
              const brackets = (possibility.expr.match(/\(/g) || []).length
              if (!solutions[possibility.value] || solutions[possibility.value].brackets > brackets) {
                solutions[possibility.value] = Object.assign({}, possibility, {brackets});
              }
            }
          }
        }
      }

      dp[mask] = [];
      for (const value in solutions) {
        dp[mask].push(solutions[value]);
      }
    }
  }
  
  const goalMask = (1 << n) - 1;
  const solutions = {};
  for (const solution of dp[goalMask]) {
    if (solution.value < epsilon) continue;
    if (Math.abs(Math.round(solution.value) - solution.value) > epsilon) continue;
    const value = Math.round(solution.value);
    if (!solutions.hasOwnProperty(value)) {
      solutions[value] = solution.expr;
    }
  }

  return solutions; // map: value -> expr
  // console.log('#configurations: ', dp[goalMask].length);
  // console.log('#unique numbers: ', Object.keys(solutions).length);
  // console.log(solutions);
}

function generate(max, n) {
  const all = {}; // value -> []possibilities
  let cumulative = 0;

  function dfs(numbers) {
    if (numbers.length < n) {
      const last = numbers.length ? numbers[numbers.length - 1] : 1;
      for (let i = last; i <= max; ++i) {
        dfs(numbers.concat(i));
      }
      return;
    }
    const solutions = calc(numbers);
    // console.error('solved:', numbers, ': ', Object.keys(solutions).length);
    cumulative += Object.keys(solutions).length;
    // console.error('cumulative:', cumulative);
    for (const value in solutions) {
      if (value < minTarget || value > maxTarget) continue;
      if (!all.hasOwnProperty(value)) {
        all[value] = [solutions[value]];
      } else {
        all[value].push(solutions[value]);
      }
    }
  }

  dfs([]);

  console.log(`Done precomputing all solutions! found ${cumulative} configurations with ${Object.keys(all).length} unique numbers.`);
  return all;
}

let solutions;

const cacheFilename = './solutions.json';

function init(max = 10, n = 4) {
  console.log('Precomputing all solutions ...');
  const startTime = new Date().getTime();
  if (fs.existsSync(cacheFilename)) {
    console.log('Cache found, loading solutions from cache ...');
    solutions = JSON.parse(fs.readFileSync(cacheFilename, 'utf-8'));
  } else {
    solutions = generate(max, n);
    fs.writeFileSync(cacheFilename, JSON.stringify(solutions), 'utf-8');
  }
  console.log(`Precomputing solutions took ${(new Date().getTime() - startTime)/1000}s`);
}

function getNumbers(str) {
  return arr = str.match(/[0-9]+/g).map(a => parseInt(a)).sort((a, b) => a - b);
}

function compareArrays(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (const i in a) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function solvePrecomputed(input, target) {
  if (typeof input === 'string') {
    input = getNumbers(input);
  } else {
    input = input.sort((a, b) => a - b);
  }

  if (!solutions.hasOwnProperty(target)) {
    return '';
  }

  for (const solution of solutions[target]) {
    if (compareArrays(input, getNumbers(solution))) {
      return solution;
    }
  }

  return '';
}

// Warning: this is computationally expensive!
function solve(input, target) {
  if (typeof input === 'string') {
    input = getNumbers(input);
  } else {
    input = input.sort((a, b) => a - b);
  }

  // First, attempt to look for solution in precomputed values.
  if (solutions.hasOwnProperty(target)) {
    for (const solution of solutions[target]) {
      if (compareArrays(input, getNumbers(solution))) {
        return solution;
      }
    }
  }

  // When we could not find precomputed ones, we have to calculate from scratch.
  const localSolutions = calc(input);
  if (localSolutions.hasOwnProperty(target)) {
    return localSolutions[target];
  }

  return '';
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getProblem(target) {
  if (!solutions.hasOwnProperty(target)) {
    return `No configuration exists to yield target ${target}`;
  }
  const solution = getRandomItem(solutions[target]);
  const numbers = shuffle(getNumbers(solution));
  return numbers.join(' ');
}

function getProblemWithRandomTarget(min = 0, max = 100) {
  const target = min + Math.floor(Math.random() * (max - min));
  if (!solutions.hasOwnProperty(target)) {
    return getProblemWithRandomTarget(min, max);
  }
  return {
    target,
    problem: getProblem(target),
  };
}

function check(answer, input, target) {
  // check operators
  if (!(/^[0-9\(\)\+\-\*\/\^\s]*$/.test(answer))) {
    return {
      valid: false,
      reason: 'Only use +, -, *, /, ^ operators or parentheses ()',
    };
  }

  // compare with input
  const answerArray = getNumbers(answer);
  const inputArray = getNumbers(input);
  if (!compareArrays(answerArray, inputArray)) {
    return {
      valid: false,
      reason: `Your answer is using these numbers: ${answerArray.join(' ')}, while the problem requires ${input}`,
    };
  }

  // evaluate math expression
  let result;
  try {
    result = mathjs.evaluate(answer);
  } catch (err) {
    return {
      valid: false,
      reason: `${answer} is not a valid math expression`,
    };
  }

  if (typeof result !== 'number') {
    return {
      valid: false,
      reason: `${answer} is not a valid math expression`,
    };
  }

  if (Math.abs(result-target) > 1e-9) {
    return {
      valid: false,
      reason: `${answer} evaluates to ${result}, target = ${target}`,
    };
  }

  return {valid: true, reason: ''};
};


module.exports = {
  init,
  solve,
  solvePrecomputed,
  getProblem,
  getProblemWithRandomTarget,
  check,
};
