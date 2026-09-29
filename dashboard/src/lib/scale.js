function niceStep(rough) {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / pow
  const nice = [1, 2, 5, 10].find((candidate) => candidate >= fraction) ?? 10
  return nice * pow
}

function finish(min, max, step) {
  const ticks = []
  for (let value = min; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  return {
    domain: [ticks[0], ticks[ticks.length - 1]],
    ticks,
    step,
  }
}

export function axisFromValues(values, mode = 'mean') {
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  if (mode === 'count') {
    const step = niceStep(maxVal / 4)
    const max = Math.ceil((maxVal - 1e-9) / step) * step
    return finish(0, max, step)
  }

  const span = Math.max(maxVal - minVal, 0.08)
  const step = niceStep(span / 3)
  let min = Math.floor((minVal + 1e-9) / step) * step
  let max = Math.ceil((maxVal - 1e-9) / step) * step
  if (min >= minVal - 1e-9) min -= step
  if (max <= maxVal + 1e-9) max += step
  if (min < 1 && minVal >= 1) min = 1
  if (max > 5 && maxVal <= 5) max = 5
  if (!(max > min)) max = min + step
  return finish(min, max, step)
}

export function formatAxisTick(value, step) {
  if (step >= 1) return Math.round(value).toLocaleString()
  return value.toFixed(step >= 0.1 ? 1 : 2)
}
