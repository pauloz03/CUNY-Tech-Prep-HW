import { useEffect, useState } from 'react'
import { HorizontalBars } from './components/HorizontalBars.jsx'
import { Methodology } from './components/Methodology.jsx'
import { YearLine } from './components/YearLine.jsx'
import {
  bestTakeaway,
  floorChangeNote,
  genreBreakdownTakeaway,
  satisfactionTakeaway,
  timeTakeaway,
} from './lib/copy.js'
import { loadDashboard } from './lib/load.js'
import { axisFromValues, formatAxisTick } from './lib/scale.js'

const QUESTIONS = {
  q1: "Q1 Genre Breakdown: What's the distribution of genres among the movies that were rated?",
  q2: 'Q2 Genre Satisfaction: Which genres have the highest average rating? Which have the lowest?',
  q3: 'Q3 Ratings Over Time: How has the mean rating changed across movie release years?',
  q4: 'Q4 Best Movies, With a Floor: What are the top 5 best-rated movies, counting only movies with at least 50 ratings? What changes if the floor is raised to 150?',
}

function formatShare(share) {
  const percent = share * 100
  if (percent > 0 && percent < 0.5) return '<1% of movies'
  return `${Math.round(percent)}% of movies`
}

function meanTone(genres, genre) {
  const top = genres[0].mean.toFixed(2)
  const bottom = genres[genres.length - 1].mean.toFixed(2)
  if (top === bottom) return 'mid'
  if (genre.mean.toFixed(2) === top) return 'high'
  if (genre.mean.toFixed(2) === bottom) return 'low'
  return 'mid'
}

export default function App() {
  const [state, setState] = useState({ status: 'loading', result: null, error: null })

  useEffect(() => {
    let cancelled = false
    loadDashboard()
      .then((result) => {
        if (!cancelled) setState({ status: 'ready', result, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', result: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p className="status">Reading the ratings file…</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <p className="status">{state.error?.message || 'The ratings file could not be read.'}</p>
      </main>
    )
  }

  const result = state.result
  const countAxis = axisFromValues(
    result.genreBreakdown.map((genre) => genre.movies),
    'count',
  )
  const satisfactionAxis = axisFromValues(result.genreSatisfaction.map((genre) => genre.mean))
  const yearAxis = axisFromValues(result.ratingsOverTime.map((year) => year.mean))
  const floorMeans = [...result.top50, ...result.top150].map((movie) => movie.mean)
  const floorAxis = axisFromValues(floorMeans)

  const genreRows = result.genreBreakdown.map((genre) => ({
    key: genre.genre,
    label: genre.genre,
    value: genre.movies,
    tone: genre.genre === 'unknown' ? 'unknown' : 'default',
    valueText: (
      <>
        <strong>{genre.movies.toLocaleString()}</strong>
        <small>{formatShare(genre.share)}</small>
      </>
    ),
  }))

  const satisfactionRows = result.genreSatisfaction.map((genre) => ({
    key: genre.genre,
    label: genre.genre,
    value: genre.mean,
    tone: meanTone(result.genreSatisfaction, genre),
    valueText: (
      <>
        <strong>{genre.mean.toFixed(2)}</strong>
        <small>
          {genre.ratings.toLocaleString()} ratings · {genre.movies.toLocaleString()} movies
        </small>
      </>
    ),
  }))

  const movieRows = (movies) =>
    movies.map((movie) => ({
      key: movie.id,
      rank: movie.rank,
      label: movie.title,
      value: movie.mean,
      tone: 'default',
      valueText: (
        <>
          <strong>{movie.mean.toFixed(2)}</strong>
          <small>{movie.count.toLocaleString()} ratings</small>
        </>
      ),
    }))

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">Movie ratings</p>
        <h1>What got rated, and how those ratings landed</h1>
        <p className="lede">
          Every chart and the sentences under them are calculated from the ratings file.
        </p>
        <dl className="stats">
          <div>
            <dt>Ratings</dt>
            <dd>{result.totalRatings.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Movies</dt>
            <dd>{result.totalMovies.toLocaleString()}</dd>
          </div>
          <div>
            <dt>People</dt>
            <dd>{result.totalUsers.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Release years</dt>
            <dd>
              {result.yearMin}–{result.yearMax}
            </dd>
          </div>
        </dl>
      </header>

      <section className="block" aria-labelledby="q1">
        <h2 id="q1">{QUESTIONS.q1}</h2>
        <HorizontalBars
          rows={genreRows}
          axis={countAxis}
          formatTick={formatAxisTick}
          categoryTitle="Genre"
          valueTitle="Number of movies"
          labelColumn="8.75rem"
          valueColumn="8.75rem"
        />
        <p className="takeaway">
          {genreBreakdownTakeaway(result.genreBreakdown, result.totalMovies)}
        </p>
      </section>

      <section className="block" aria-labelledby="q2">
        <h2 id="q2">{QUESTIONS.q2}</h2>
        <ul className="legend">
          <li>
            <i className="swatch tone-high" /> Highest
          </li>
          <li>
            <i className="swatch tone-low" /> Lowest
          </li>
        </ul>
        <HorizontalBars
          rows={satisfactionRows}
          axis={satisfactionAxis}
          formatTick={formatAxisTick}
          categoryTitle="Genre"
          valueTitle="Mean rating (1–5)"
          labelColumn="8.75rem"
          valueColumn="13.5rem"
        />
        <p className="scale-note">
          The scale runs from {formatAxisTick(satisfactionAxis.domain[0], satisfactionAxis.step)} to{' '}
          {formatAxisTick(satisfactionAxis.domain[1], satisfactionAxis.step)} so differences on the 1–5
          scale stay visible.
        </p>
        <p className="takeaway">{satisfactionTakeaway(result.genreSatisfaction)}</p>
      </section>

      <section className="block" aria-labelledby="q3">
        <h2 id="q3">{QUESTIONS.q3}</h2>
        <YearLine series={result.ratingsOverTime} axis={yearAxis} formatTick={formatAxisTick} />
        <p className="scale-note">
          Hover a year for its mean, rating count, and movie count. Gaps are release years with no
          rated movies.
        </p>
        <p className="takeaway">
          {timeTakeaway(result.ratingsOverTime, result.trendPerDecade)}
        </p>
      </section>

      <section className="block" aria-labelledby="q4">
        <h2 id="q4">{QUESTIONS.q4}</h2>
        <div className="split">
          <div>
            <h3>At least 50 ratings</h3>
            <HorizontalBars
              variant="ranked"
              rows={movieRows(result.top50)}
              axis={floorAxis}
              formatTick={formatAxisTick}
              categoryTitle="Movie"
              valueTitle="Mean rating (1–5)"
              valueColumn="8.5rem"
            />
          </div>
          <div>
            <h3>At least 150 ratings</h3>
            <HorizontalBars
              variant="ranked"
              rows={movieRows(result.top150)}
              axis={floorAxis}
              formatTick={formatAxisTick}
              categoryTitle="Movie"
              valueTitle="Mean rating (1–5)"
              valueColumn="8.5rem"
            />
          </div>
        </div>
        <p className="scale-note">
          Both charts use the same scale, from {formatAxisTick(floorAxis.domain[0], floorAxis.step)} to{' '}
          {formatAxisTick(floorAxis.domain[1], floorAxis.step)} on the 1–5 rating scale.
        </p>
        <p className="takeaway">{bestTakeaway(result.top50, result.top150)}</p>
        <p className="note">
          <span className="note-label">What changed</span>
          {floorChangeNote(result.top50, result.top150, result.eligible50, result.eligible150)}
        </p>
      </section>

      <Methodology result={result} />
    </main>
  )
}
