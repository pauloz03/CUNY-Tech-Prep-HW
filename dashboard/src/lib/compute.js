const YEAR_IN_TITLE = /\((\d{4})\)/

function releaseYear(yearField, title) {
  const raw = yearField == null ? '' : String(yearField).trim()
  if (raw !== '') {
    const year = Math.trunc(Number(raw))
    return Number.isFinite(year) ? year : null
  }
  const match = String(title).match(YEAR_IN_TITLE)
  return match ? Number(match[1]) : null
}

function weightedSlopePerDecade(points) {
  let weight = 0
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0
  for (const point of points) {
    const w = point.ratings
    weight += w
    sumX += w * point.year
    sumY += w * point.mean
    sumXX += w * point.year * point.year
    sumXY += w * point.year * point.mean
  }
  const denominator = weight * sumXX - sumX * sumX
  if (denominator === 0) return 0
  return ((weight * sumXY - sumX * sumY) / denominator) * 10
}

function rankMovies(movies, floor) {
  return movies
    .filter((movie) => movie.count >= floor)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      mean: movie.sum / movie.count,
      count: movie.count,
    }))
    .sort((a, b) => b.mean - a.mean || b.count - a.count || a.id - b.id)
    .slice(0, 5)
    .map((movie, index) => ({ ...movie, rank: index + 1 }))
}

export function computeDashboard(records) {
  const users = new Set()
  const seenPairs = new Set()
  const movies = new Map()
  let duplicatePairs = 0
  let skippedRows = 0
  let ratingMin = Infinity
  let ratingMax = -Infinity
  let totalRatings = 0

  for (const row of records) {
    const rating = Number(row.rating)
    const movieId = String(row.movie_id ?? '').trim()
    if (!movieId || !Number.isFinite(rating)) {
      skippedRows += 1
      continue
    }

    const pairKey = `${row.user_id}\0${movieId}`
    if (seenPairs.has(pairKey)) duplicatePairs += 1
    else seenPairs.add(pairKey)

    users.add(row.user_id)
    totalRatings += 1
    if (rating < ratingMin) ratingMin = rating
    if (rating > ratingMax) ratingMax = rating

    let movie = movies.get(movieId)
    if (!movie) {
      const rawYear = row.year == null ? '' : String(row.year).trim()
      const year = releaseYear(row.year, row.title)
      const genres = [
        ...new Set(
          String(row.genres)
            .split('|')
            .map((genre) => genre.trim())
            .filter(Boolean),
        ),
      ]
      movie = {
        id: Number(movieId),
        title: String(row.title).trim(),
        year,
        yearFromTitle: rawYear === '' && year != null,
        genres,
        sum: 0,
        count: 0,
      }
      movies.set(movieId, movie)
    }
    movie.sum += rating
    movie.count += 1
  }

  const movieList = [...movies.values()]
  const totalMovies = movieList.length

  const genreStats = new Map()
  const yearStats = new Map()
  let moviesYearFromTitle = 0
  let ratingsYearFromTitle = 0
  let moviesWithoutYear = 0
  let ratingsWithoutYear = 0

  for (const movie of movieList) {
    for (const genre of movie.genres) {
      let stats = genreStats.get(genre)
      if (!stats) {
        stats = { genre, movies: 0, ratings: 0, sum: 0 }
        genreStats.set(genre, stats)
      }
      stats.movies += 1
      stats.ratings += movie.count
      stats.sum += movie.sum
    }

    if (movie.yearFromTitle) {
      moviesYearFromTitle += 1
      ratingsYearFromTitle += movie.count
    }
    if (movie.year == null) {
      moviesWithoutYear += 1
      ratingsWithoutYear += movie.count
      continue
    }

    let yearBucket = yearStats.get(movie.year)
    if (!yearBucket) {
      yearBucket = { year: movie.year, movies: 0, ratings: 0, sum: 0 }
      yearStats.set(movie.year, yearBucket)
    }
    yearBucket.movies += 1
    yearBucket.ratings += movie.count
    yearBucket.sum += movie.sum
  }

  const genreBreakdown = [...genreStats.values()]
    .map((genre) => ({ ...genre, share: genre.movies / totalMovies }))
    .sort((a, b) => b.movies - a.movies || b.ratings - a.ratings)

  const genreSatisfaction = [...genreStats.values()]
    .filter((genre) => genre.genre !== 'unknown')
    .map((genre) => ({ ...genre, mean: genre.sum / genre.ratings }))
    .sort((a, b) => b.mean - a.mean || b.ratings - a.ratings || b.movies - a.movies)

  const ratingsOverTime = [...yearStats.values()]
    .map((year) => ({ ...year, mean: year.sum / year.ratings }))
    .sort((a, b) => a.year - b.year)

  const eligible50 = movieList.filter((movie) => movie.count >= 50).length
  const eligible150 = movieList.filter((movie) => movie.count >= 150).length

  return {
    totalRatings,
    totalUsers: users.size,
    totalMovies,
    ratingMin,
    ratingMax,
    duplicatePairs,
    skippedRows,
    moviesYearFromTitle,
    ratingsYearFromTitle,
    moviesWithoutYear,
    ratingsWithoutYear,
    yearMin: ratingsOverTime[0]?.year ?? null,
    yearMax: ratingsOverTime[ratingsOverTime.length - 1]?.year ?? null,
    genreBreakdown,
    genreSatisfaction,
    ratingsOverTime,
    trendPerDecade: weightedSlopePerDecade(ratingsOverTime),
    top50: rankMovies(movieList, 50),
    top150: rankMovies(movieList, 150),
    eligible50,
    eligible150,
  }
}
