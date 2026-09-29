function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`
}

function joinWords(items) {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function quote(text) {
  return `“${text}”`
}

function displayedMean(value) {
  return value.toFixed(2)
}

function matchingMean(rows, mean) {
  const label = displayedMean(mean)
  return rows.filter((row) => displayedMean(row.mean) === label)
}

export function genreBreakdownTakeaway(genres, totalMovies) {
  const leader = genres[0]
  const tied = genres.filter((genre) => genre.movies === leader.movies)
  const shareSum = genres.reduce((sum, genre) => sum + genre.share, 0)
  const opening =
    tied.length === 1
      ? `${leader.genre} is listed on ${leader.movies.toLocaleString()} of ${totalMovies.toLocaleString()} movies (${Math.round(leader.share * 100)}%).`
      : `${joinWords(tied.map((genre) => genre.genre))} are each listed on ${leader.movies.toLocaleString()} of ${totalMovies.toLocaleString()} movies.`
  const overlap =
    shareSum > 1.001
      ? `A movie is counted in every genre it lists, so the percentages add up to ${Math.round(shareSum * 100)}%.`
      : 'Each movie lists one genre, so the percentages add up to 100%.'
  return `${opening} ${overlap}`
}

function satisfactionClause(groups, extreme) {
  if (groups.length === 1) {
    const genre = groups[0]
    return `${extreme} average rating is ${genre.genre} at ${displayedMean(genre.mean)}, across ${genre.ratings.toLocaleString()} ratings`
  }
  const names = groups.map(
    (genre) => `${genre.genre} (${genre.ratings.toLocaleString()} ratings)`,
  )
  return `${extreme} average rating is shared by ${joinWords(names)}, all at ${displayedMean(groups[0].mean)} when rounded to two decimals`
}

export function satisfactionTakeaway(genres) {
  const highest = matchingMean(genres, genres[0].mean)
  const lowest = matchingMean(genres, genres[genres.length - 1].mean)
  if (displayedMean(highest[0].mean) === displayedMean(lowest[0].mean)) {
    return `Every genre rounds to the same average rating, ${displayedMean(highest[0].mean)}.`
  }
  return `${satisfactionClause(highest, 'The highest')}. ${satisfactionClause(lowest, 'The lowest')}.`
}

function yearDetail(year) {
  const movies = year.movies === 1 ? 'movie' : 'movies'
  return `${year.year} (${displayedMean(year.mean)}, ${year.ratings.toLocaleString()} ratings of ${year.movies.toLocaleString()} ${movies})`
}

function extremeYears(years) {
  if (years.length <= 3) return joinWords(years.map(yearDetail))
  const shown = years.slice(0, 2).map(yearDetail)
  const rest = years.length - shown.length
  return `${shown.join(' and ')}, and ${rest} more years, all ${displayedMean(years[0].mean)} when rounded to two decimals`
}

export function timeTakeaway(series, perDecade) {
  const highest = matchingMean(series, Math.max(...series.map((year) => year.mean)))
  const lowest = matchingMean(series, Math.min(...series.map((year) => year.mean)))
  const opening = `Mean rating peaks for movies released in ${extremeYears(highest)} and is lowest for ${extremeYears(lowest)}.`
  const start = series[0].year
  const end = series[series.length - 1].year
  const magnitude = Math.abs(perDecade)
  const amount = magnitude < 0.005 ? 'less than 0.01 points per decade' : `${magnitude.toFixed(2)} points per decade`
  const trend =
    magnitude < 0.03
      ? `Giving busier years more weight, a straight line through these yearly averages barely moves between ${start} and ${end} (about ${amount}).`
      : `Giving busier years more weight, a straight line through these yearly averages ${perDecade > 0 ? 'rises' : 'falls'} by about ${amount} between ${start} and ${end}.`
  return `${opening} ${trend}`
}

export function bestTakeaway(top50, top150) {
  if (top50.length === 0) return 'No movie has at least 50 ratings.'
  const leader = top50[0]
  if (top150.length === 0) {
    return `${quote(leader.title)} leads the movies with at least 50 ratings, with a mean of ${displayedMean(leader.mean)} from ${leader.count.toLocaleString()} ratings. No movie reaches 150 ratings.`
  }
  const leader150 = top150[0]
  if (leader.id === leader150.id) {
    return `${quote(leader.title)} is first at both floors, with a mean of ${displayedMean(leader.mean)} from ${leader.count.toLocaleString()} ratings. Raising the floor from 50 to 150 does not change who ranks first.`
  }
  return `${quote(leader.title)} is first when a movie needs at least 50 ratings, with a mean of ${displayedMean(leader.mean)} from ${leader.count.toLocaleString()} ratings. At 150 ratings, ${quote(leader150.title)} ranks first instead, with a mean of ${displayedMean(leader150.mean)} from ${leader150.count.toLocaleString()} ratings.`
}

export function floorChangeNote(top50, top150, eligible50, eligible150) {
  const pool = `${eligible50.toLocaleString()} movies have at least 50 ratings. ${eligible150.toLocaleString()} still have at least 150.`
  if (top50.length === 0 || top150.length === 0) return pool

  const ids150 = new Set(top150.map((movie) => movie.id))
  const ids50 = new Set(top50.map((movie) => movie.id))
  const dropped = top50.filter((movie) => !ids150.has(movie.id))
  const added = top150.filter((movie) => !ids50.has(movie.id))
  const sameOrder = top50.every((movie, index) => movie.id === top150[index]?.id)

  if (sameOrder) {
    return `${pool} The top 5 names, and their order, stay the same when the floor rises to 150.`
  }
  if (dropped.length === 0 && added.length === 0) {
    const lead = top50[0].id === top150[0].id
      ? 'The same five movies qualify at both floors, but not in the same order.'
      : `The same five movies qualify at both floors, with ${quote(top150[0].title)} moving into first place.`
    return `${pool} ${lead}`
  }

  const parts = []
  if (dropped.length > 0) parts.push(`removes ${joinWords(dropped.map((movie) => quote(movie.title)))}`)
  if (added.length > 0) parts.push(`brings in ${joinWords(added.map((movie) => quote(movie.title)))}`)
  return `${pool} Raising the floor from 50 to 150 ${parts.join(' and ')}.`
}

export function countingNote(result) {
  const repeats =
    result.duplicatePairs === 0
      ? 'No person rated the same movie more than once, so each row is one rating.'
      : `${plural(result.duplicatePairs, 'user-movie pair')} appeared more than once; each row is still counted separately.`
  const skipped =
    result.skippedRows === 0
      ? ''
      : ` ${plural(result.skippedRows, 'row')} could not be read as a rating and ${result.skippedRows === 1 ? 'was' : 'were'} skipped.`
  return `Each row is one person’s rating of one movie, and movies are grouped by movie id so remakes stay separate. ${repeats}${skipped} Ratings in this file run from ${result.ratingMin} to ${result.ratingMax}. Averages are the mean of rating rows, so a heavily rated movie pulls more than a movie with one rating.`
}

export function yearRuleNote(result) {
  const filled =
    result.moviesYearFromTitle === 0
      ? 'Every movie already had a release year in the year column.'
      : `The title supplied a release year for ${plural(result.moviesYearFromTitle, 'movie')} (${plural(result.ratingsYearFromTitle, 'rating')}) whose year column was blank.`
  const missing =
    result.moviesWithoutYear === 0
      ? 'No rated movie was missing a release year.'
      : `${plural(result.moviesWithoutYear, 'movie')} (${plural(result.ratingsWithoutYear, 'rating')}) had no year in the column or the title, so ${result.moviesWithoutYear === 1 ? 'it is' : 'they are'} left out of the time chart.`
  return `${filled} ${missing}`
}
