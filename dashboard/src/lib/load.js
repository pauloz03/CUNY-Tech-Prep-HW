import ratingsUrl from '../../../movie_ratings.csv?url'
import { computeDashboard } from './compute.js'
import { parseCsv } from './parseCsv.js'

let pending

export function loadDashboard() {
  if (!pending) {
    pending = fetch(ratingsUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the ratings file.')
        return response.text()
      })
      .then((text) => computeDashboard(parseCsv(text)))
  }
  return pending
}
