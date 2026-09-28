// src/utils/mathEval.js
// A small, safe recursive-descent parser/evaluator for arithmetic expressions.
// Deliberately does NOT use eval() or new Function() — only digits, whitespace,
// and the operators + - * / ^ ( ) are ever accepted, and the grammar below is
// the only thing that decides what runs, so there is no code-injection surface.

class MathEvalError extends Error {}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      if ((num.match(/\./g) || []).length > 1) throw new MathEvalError('Invalid number');
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new MathEvalError(`Unexpected character: "${ch}"`);
  }
  return tokens;
}

// Grammar (lowest to highest precedence):
//   expr   := term (('+' | '-') term)*
//   term   := power (('*' | '/') power)*
//   power  := unary ('^' power)?      (right-associative)
//   unary  := '-' unary | atom
//   atom   := number | '(' expr ')'
function parse(tokens) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function parseAtom() {
    const t = peek();
    if (!t) throw new MathEvalError('Unexpected end of expression');
    if (t.type === 'num') { next(); return t.value; }
    if (t.type === 'op' && t.value === '(') {
      next();
      const val = parseExpr();
      const close = next();
      if (!close || close.value !== ')') throw new MathEvalError('Missing closing parenthesis');
      return val;
    }
    throw new MathEvalError('Unexpected token');
  }

  function parseUnary() {
    const t = peek();
    if (t && t.type === 'op' && t.value === '-') {
      next();
      return -parseUnary();
    }
    return parseAtom();
  }

  function parsePower() {
    const base = parseUnary();
    const t = peek();
    if (t && t.type === 'op' && t.value === '^') {
      next();
      const exponent = parsePower(); // right-associative
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parseTerm() {
    let val = parsePower();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        next();
        const rhs = parsePower();
        if (t.value === '*') val *= rhs;
        else {
          if (rhs === 0) throw new MathEvalError('Division by zero');
          val /= rhs;
        }
      } else break;
    }
    return val;
  }

  function parseExpr() {
    let val = parseTerm();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        next();
        const rhs = parseTerm();
        val = t.value === '+' ? val + rhs : val - rhs;
      } else break;
    }
    return val;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new MathEvalError('Unexpected trailing tokens');
  return result;
}

/**
 * Safely evaluate a basic arithmetic expression. Never uses eval/Function.
 * @param {string} expr
 * @returns {number}
 * @throws {MathEvalError} on any invalid input
 */
function safeMathEval(expr) {
  if (typeof expr !== 'string' || !expr.trim()) throw new MathEvalError('Empty expression');
  if (expr.length > 200) throw new MathEvalError('Expression too long');
  const tokens = tokenize(expr);
  const result = parse(tokens);
  if (!Number.isFinite(result)) throw new MathEvalError('Result is not a finite number');
  return result;
}

module.exports = { safeMathEval, MathEvalError };
