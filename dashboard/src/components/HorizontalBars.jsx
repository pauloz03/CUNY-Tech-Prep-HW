function tickShift(percent) {
  if (percent < 8) return 'translateX(0)'
  if (percent > 92) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

function Ticks({ axis, formatTick }) {
  const [min, max] = axis.domain
  const span = max - min || 1
  return (
    <div className="ticks">
      {axis.ticks.map((tick) => {
        const percent = ((tick - min) / span) * 100
        return (
          <span
            key={tick}
            className="tick"
            style={{ left: `${percent}%`, transform: tickShift(percent) }}
          >
            {formatTick(tick, axis.step)}
          </span>
        )
      })}
    </div>
  )
}

function Bar({ tone, width }) {
  return (
    <div className="track" aria-hidden="true">
      <div className={`fill tone-${tone || 'default'}`} style={{ width, minWidth: '5px' }} />
    </div>
  )
}

export function HorizontalBars({
  rows,
  axis,
  formatTick,
  categoryTitle,
  valueTitle,
  variant = 'labeled',
  valueColumn = '8.5rem',
  labelColumn = '8.5rem',
}) {
  const [min, max] = axis.domain
  const span = max - min || 1
  const widthFor = (value) => `${Math.max(0, Math.min(100, ((value - min) / span) * 100))}%`
  const columns = {
    '--label-col': labelColumn,
    '--value-col': valueColumn,
  }

  if (variant === 'ranked') {
    return (
      <figure className="chart">
        <p className="axis-title">{categoryTitle}</p>
        <ol className="ranked">
          {rows.map((row) => (
            <li key={row.key}>
              <p className="ranked-title">
                <span className="rank">{row.rank}</span>
                <span>{row.label}</span>
              </p>
              <div className="meter" style={columns}>
                <Bar tone={row.tone} width={widthFor(row.value)} />
                <div className="hbar-value">{row.valueText}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="meter scale-row" style={columns}>
          <div>
            <Ticks axis={axis} formatTick={formatTick} />
            <p className="axis-title">{valueTitle}</p>
          </div>
          <span aria-hidden="true" />
        </div>
      </figure>
    )
  }

  return (
    <figure className="chart" style={columns}>
      <div className="meter labeled-head">
        <p className="axis-title">{categoryTitle}</p>
        <span />
        <span />
      </div>
      <ol className="labeled">
        {rows.map((row) => (
          <li key={row.key} className="meter">
            <span className="hbar-label">{row.label}</span>
            <Bar tone={row.tone} width={widthFor(row.value)} />
            <div className="hbar-value">{row.valueText}</div>
          </li>
        ))}
      </ol>
      <div className="meter scale-row">
        <span />
        <div>
          <Ticks axis={axis} formatTick={formatTick} />
          <p className="axis-title">{valueTitle}</p>
        </div>
        <span />
      </div>
    </figure>
  )
}
