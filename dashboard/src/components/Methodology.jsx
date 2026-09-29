import { countingNote, yearRuleNote } from '../lib/copy.js'

export function Methodology({ result }) {
  const unknown = result.genreBreakdown.find((genre) => genre.genre === 'unknown')
  return (
    <section className="block method" id="assumptions">
      <h2>Assumptions and methodology</h2>
      <p className="applied">{countingNote(result)}</p>

      <h3>Genre breakdown</h3>
      <ul>
        <li>Genres are split on the pipe character. A movie is counted once in every genre it lists.</li>
        <li>The bar length is the number of rated movies that include that genre, not the number of ratings. A movie with one rating weighs the same as a movie with hundreds.</li>
        <li>Every movie in the file has at least one rating. That full set, {result.totalMovies.toLocaleString()} movies, is the denominator for the share printed beside each bar.</li>
        <li>Multi-genre movies make the shares add up to more than 100%. The first label in a list is not treated as a primary genre.</li>
        <li>
          The stored label “unknown” is kept as its own category
          {unknown ? ` (${unknown.movies.toLocaleString()} ${unknown.movies === 1 ? 'movie' : 'movies'})` : ''}.
        </li>
        <li>If two genres have the same movie count, the one with more ratings is listed first.</li>
      </ul>

      <h3>Genre satisfaction</h3>
      <ul>
        <li>The average for a genre is the mean of every rating whose movie lists that genre. A rating on a multi-genre movie enters each of those genres.</li>
        <li>That is rating-weighted. It is not the average of each movie’s own mean, which would give a one-rating movie the same pull as a blockbuster.</li>
        <li>The label “unknown” is left out of this ranking. There is no minimum number of ratings, so a small genre can still land at either end. The rating count and movie count are printed beside the mean.</li>
        <li>Bars are ordered by the exact mean, then by more ratings, then by more movies. If two genres match once the mean is rounded to two decimals, the sentence under the chart calls them tied.</li>
      </ul>

      <h3>Ratings over time</h3>
      <ul>
        <li>The year is the movie’s release year. The year the rating was submitted, and the timestamp, are not used.</li>
        <li>Each point is the mean of rating rows for movies released that year, so busy movies pull more than movies with one rating.</li>
        <li>If the year column is blank and the title contains a four-digit year in parentheses, that title year is used.</li>
        <li>A movie with no year in either place is left out. Years with no rated movies are omitted, and the line breaks instead of dropping to zero.</li>
        <li>The trend sentence fits a straight line through the individual ratings and reports the change per decade. It gives a year with more ratings more say.</li>
      </ul>
      <p className="applied">{yearRuleNote(result)}</p>

      <h3>Best movies, with a floor</h3>
      <ul>
        <li>A movie’s score is the unrounded mean of its ratings. Movies are grouped by movie id. Titles are shown as stored, which already includes the release year.</li>
        <li>The floor is applied before ranking: first at least 50 ratings, then again from scratch at 150. The second list is not the first list with rows removed.</li>
        <li>The tie-break is more ratings, then the lower movie id. Means are shown to two decimals, with the rating count beside each title.</li>
        <li>No shrinkage or Bayesian average is applied. A 4.6 from 50 ratings still outranks a 4.4 from 500 ratings. The higher floor is the control for that.</li>
        <li>
          {result.eligible50.toLocaleString()} movies clear 50 ratings, and {result.eligible150.toLocaleString()} clear 150
          {result.eligible50 >= 5 && result.eligible150 >= 5 ? ', so both lists have a full top 5' : ''}.
        </li>
      </ul>

      <h3>How the charts are drawn</h3>
      <ul>
        <li>Genre bars are sorted by movie count or by mean rating, with the largest value at the top. The time chart runs from earlier release years to later ones. Neither chart is alphabetical.</li>
        <li>Movie-count bars start at zero. Mean-rating charts use a narrowed scale around the values on screen so gaps on the 1–5 scale stay visible. The axis title names that full scale.</li>
        <li>The two top-5 charts share one scale, so a longer bar is a higher mean in both panels.</li>
      </ul>
    </section>
  )
}
