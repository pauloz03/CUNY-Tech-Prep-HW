import { useMemo, useState } from 'react'

const W = 760
const H = 360
const PAD = { top: 18, right: 16, bottom: 48, left: 56 }

function contiguousRuns(points) {
  const runs = []
  let run = []
  let previous = null
  for (const point of points) {
    if (previous != null && point.year !== previous + 1) {
      runs.push(run)
      run = []
    }
    run.push(point)
    previous = point.year
  }
  if (run.length > 0) runs.push(run)
  return runs
}

export function YearLine({ series, axis, formatTick }) {
  const [hover, setHover] = useState(null)
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const [yMin, yMax] = axis.domain
  const yearMin = series[0].year
  const yearMax = series[series.length - 1].year

  const points = useMemo(() => {
    return series.map((year) => {
      const x = PAD.left + ((year.year - yearMin) / (yearMax - yearMin || 1)) * plotW
      const y = PAD.top + ((yMax - year.mean) / (yMax - yMin || 1)) * plotH
      return { ...year, x, y }
    })
  }, [series, yearMin, yearMax, yMin, yMax, plotW, plotH])

  const runs = useMemo(() => contiguousRuns(points), [points])

  const yearTicks = []
  const firstDecade = Math.ceil(yearMin / 10) * 10
  for (let year = firstDecade; year <= yearMax; year += 10) yearTicks.push(year)

  function move(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    let nearest = points[0]
    let best = Infinity
    for (const point of points) {
      const distance = Math.abs(point.x - x)
      if (distance < best) {
        nearest = point
        best = distance
      }
    }
    setHover(nearest)
  }

  const tipOnLeft = hover && hover.x > W * 0.62
  const tipBelow = hover && hover.y < 78

  return (
    <div className="line-scroll">
      <div className="line-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Mean rating by movie release year"
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
        >
          {axis.ticks.map((tick) => {
            const y = PAD.top + ((yMax - tick) / (yMax - yMin || 1)) * plotH
            return (
              <g key={tick}>
                <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
                <text className="svg-tick" x={PAD.left - 8} y={y + 4} textAnchor="end">
                  {formatTick(tick, axis.step)}
                </text>
              </g>
            )
          })}
          <line className="axis-line" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} />
          <line
            className="axis-line"
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
          />
          {yearTicks.map((year) => {
            const x = PAD.left + ((year - yearMin) / (yearMax - yearMin || 1)) * plotW
            return (
              <text key={year} className="svg-tick" x={x} y={PAD.top + plotH + 20} textAnchor="middle">
                {year}
              </text>
            )
          })}
          <text className="svg-axis" x={18} y={PAD.top + plotH / 2} transform={`rotate(-90 18 ${PAD.top + plotH / 2})`} textAnchor="middle">
            Mean rating (1–5)
          </text>
          <text className="svg-axis" x={PAD.left + plotW / 2} y={H - 8} textAnchor="middle">
            Release year
          </text>
          {runs.map((run) =>
            run.length > 1 ? (
              <polyline
                key={run[0].year}
                className="year-line"
                points={run.map((point) => `${point.x},${point.y}`).join(' ')}
              />
            ) : null,
          )}
          {hover && (
            <line className="hover-line" x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          {points.map((point) => (
            <circle
              key={point.year}
              className={hover?.year === point.year ? 'year-dot is-active' : 'year-dot'}
              cx={point.x}
              cy={point.y}
              r={hover?.year === point.year ? 5 : 3.2}
            />
          ))}
        </svg>
        {hover && (
          <div
            className="tip"
            style={{
              left: `${(hover.x / W) * 100}%`,
              top: `${(hover.y / H) * 100}%`,
              transform: `${tipOnLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'} ${tipBelow ? 'translateY(12px)' : 'translateY(calc(-100% - 12px))'}`,
            }}
          >
            <strong>{hover.year}</strong>
            <span>Mean {hover.mean.toFixed(2)}</span>
            <span>
              {hover.ratings.toLocaleString()} ratings · {hover.movies.toLocaleString()}{' '}
              {hover.movies === 1 ? 'movie' : 'movies'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
