from pathlib import Path

import altair as alt
import streamlit as st

from dashboard_data import DATA_PATH, compute_dashboard

QUESTIONS = {
    "q1": "Q1 Genre Breakdown: What's the distribution of genres among the movies that were rated?",
    "q2": "Q2 Genre Satisfaction: Which genres have the highest average rating? Which have the lowest?",
    "q3": "Q3 Ratings Over Time: How has the mean rating changed across movie release years?",
    "q4": "Q4 Best Movies, With a Floor: What are the top 5 best-rated movies, counting only movies with at least 50 ratings? What changes if the floor is raised to 150?",
}

BAR = "#8e2f24"
LOW = "#35574c"
MID = "#c4846a"
UNKNOWN = "#8d7d68"


@st.cache_data(show_spinner="Reading the ratings file…")
def load_dashboard(path):
    return compute_dashboard(path)


def _mean_domain(values):
    low = float(min(values))
    high = float(max(values))
    pad = max(0.05, (high - low) * 0.12)
    return [max(1.0, low - pad), min(5.0, high + pad)]


def genre_chart(genres):
    colored = genres.copy()
    colored["series"] = colored["genre"].map(lambda genre: "unknown" if genre == "unknown" else "genre")
    return (
        alt.Chart(colored)
        .mark_bar()
        .encode(
            x=alt.X(
                "movies:Q",
                title="Number of movies",
                scale=alt.Scale(domain=[0, float(colored["movies"].max()) * 1.08], zero=True),
            ),
            y=alt.Y(
                "genre:N",
                title="Genre",
                sort=alt.EncodingSortField(field="order", order="ascending"),
            ),
            color=alt.Color(
                "series:N",
                title="",
                scale=alt.Scale(domain=["genre", "unknown"], range=[BAR, UNKNOWN]),
                legend=None,
            ),
            tooltip=[
                alt.Tooltip("genre:N", title="Genre"),
                alt.Tooltip("movies:Q", title="Movies", format=","),
                alt.Tooltip("share:Q", title="Share of movies", format=".1%"),
            ],
        )
        .properties(height=max(420, 24 * len(colored)))
    )


def satisfaction_chart(genres):
    colored = genres.copy()
    high = f"{colored.iloc[0]['mean']:.2f}"
    low = f"{colored.iloc[-1]['mean']:.2f}"

    def tone(mean):
        label = f"{mean:.2f}"
        if high != low and label == high:
            return "Highest"
        if high != low and label == low:
            return "Lowest"
        return "Other"

    colored["tone"] = colored["mean"].map(tone)
    domain = _mean_domain(colored["mean"])
    return (
        alt.Chart(colored)
        .mark_bar()
        .encode(
            x=alt.X("mean:Q", title="Mean rating (1–5)", scale=alt.Scale(domain=domain, zero=False)),
            y=alt.Y(
                "genre:N",
                title="Genre",
                sort=alt.EncodingSortField(field="order", order="ascending"),
            ),
            color=alt.Color(
                "tone:N",
                title="",
                scale=alt.Scale(domain=["Highest", "Other", "Lowest"], range=[BAR, MID, LOW]),
            ),
            tooltip=[
                alt.Tooltip("genre:N", title="Genre"),
                alt.Tooltip("mean:Q", title="Mean rating", format=".2f"),
                alt.Tooltip("ratings:Q", title="Ratings", format=","),
                alt.Tooltip("movies:Q", title="Movies", format=","),
            ],
        )
        .properties(height=max(420, 24 * len(colored)))
    )


def year_chart(years):
    domain = _mean_domain(years["mean"])
    base = alt.Chart(years).encode(
        x=alt.X("year:Q", title="Release year", axis=alt.Axis(format="d", tickCount=8)),
        y=alt.Y("mean:Q", title="Mean rating (1–5)", scale=alt.Scale(domain=domain, zero=False)),
        tooltip=[
            alt.Tooltip("year:Q", title="Release year", format="d"),
            alt.Tooltip("mean:Q", title="Mean rating", format=".2f"),
            alt.Tooltip("ratings:Q", title="Ratings", format=","),
            alt.Tooltip("movies:Q", title="Movies", format=","),
        ],
    )
    line = base.mark_line(color=BAR, strokeWidth=2.25).encode(detail="segment:N")
    points = base.mark_circle(color=BAR, size=46)
    return (line + points).properties(height=380)


def movie_chart(movies, domain):
    low, high = domain
    span = high - low or 1
    rows = [
        "<div style='margin:0 0 0.15rem;color:#5e5348;font-size:0.75rem;font-weight:700;"
        "letter-spacing:0.06em;text-transform:uppercase'>Movie</div>"
    ]
    for _, row in movies.iterrows():
        width = max(0, min(100, (float(row["mean"]) - low) / span * 100))
        rows.append(
            "<div style='margin:0.7rem 0 0'>"
            f"<div style='font-weight:600'>{int(row['rank'])}. {row['title']}</div>"
            "<div style='display:grid;grid-template-columns:minmax(0,1fr) 7.2rem;gap:0.6rem;align-items:center;margin-top:0.2rem'>"
            "<div style='background:#eadfce;border-radius:999px;height:0.7rem'>"
            f"<div style='width:{width:.1f}%;background:{BAR};height:0.7rem;border-radius:999px'></div>"
            "</div>"
            f"<div><strong>{float(row['mean']):.2f}</strong><br>"
            f"<span style='color:#5e5348;font-size:0.8rem'>{int(row['count']):,} ratings</span></div>"
            "</div></div>"
        )
    rows.append(
        "<div style='margin-top:0.45rem;color:#5e5348;font-size:0.75rem;font-weight:700;"
        "letter-spacing:0.06em;text-transform:uppercase;text-align:center'>"
        f"Mean rating (1–5)</div>"
    )
    st.markdown("".join(rows), unsafe_allow_html=True)


def methodology(summary, genres):
    unknown = genres.loc[genres["genre"].eq("unknown")]
    unknown_note = ""
    if not unknown.empty:
        count = int(unknown.iloc[0]["movies"])
        unknown_note = f" ({count:,} {'movie' if count == 1 else 'movies'})"
    full_top = ""
    if summary["eligible50"] >= 5 and summary["eligible150"] >= 5:
        full_top = ", so both lists have a full top 5"
    st.header("Assumptions and methodology")
    st.write(summary["counting_note"])
    st.subheader("Genre breakdown")
    st.markdown(
        "\n".join(
            [
                "- Genres are split on the pipe character. A movie is counted once in every genre it lists.",
                "- The bar length is the number of rated movies that include that genre, not the number of ratings. A movie with one rating weighs the same as a movie with hundreds.",
                f"- Every movie in the file has at least one rating. That full set, {summary['total_movies']:,} movies, is the denominator for the share of movies.",
                "- Multi-genre movies make the shares add up to more than 100%. The first label in a list is not treated as a primary genre.",
                f"- The stored label “unknown” is kept as its own category{unknown_note}.",
                "- If two genres have the same movie count, the one with more ratings is listed first.",
            ]
        )
    )
    st.subheader("Genre satisfaction")
    st.markdown(
        "\n".join(
            [
                "- The average for a genre is the mean of every rating whose movie lists that genre. A rating on a multi-genre movie enters each of those genres.",
                "- That is rating-weighted. It is not the average of each movie’s own mean, which would give a one-rating movie the same pull as a blockbuster.",
                "- The label “unknown” is left out of this ranking. There is no minimum number of ratings, so a small genre can still land at either end. The rating count and movie count are available on each bar.",
                "- Bars are ordered by the exact mean, then by more ratings, then by more movies. If two genres match once the mean is rounded to two decimals, the sentence under the chart calls them tied.",
            ]
        )
    )
    st.subheader("Ratings over time")
    st.markdown(
        "\n".join(
            [
                "- The year is the movie’s release year. The year the rating was submitted, and the timestamp, are not used.",
                "- Each point is the mean of rating rows for movies released that year, so busy movies pull more than movies with one rating.",
                "- If the year column is blank and the title contains a four-digit year in parentheses, that title year is used.",
                "- A movie with no year in either place is left out. Years with no rated movies are omitted, and the line breaks instead of dropping to zero.",
                "- The trend sentence fits a straight line through the individual ratings and reports the change per decade. It gives a year with more ratings more say.",
            ]
        )
    )
    st.write(summary["year_note"])
    st.subheader("Best movies, with a floor")
    st.markdown(
        "\n".join(
            [
                "- A movie’s score is the unrounded mean of its ratings. Movies are grouped by movie id. Titles are shown as stored, which already includes the release year.",
                "- The floor is applied before ranking: first at least 50 ratings, then again from scratch at 150. The second list is not the first list with rows removed.",
                "- The tie-break is more ratings, then the lower movie id. Means are shown to two decimals, with the rating count beside each title.",
                "- No shrinkage or Bayesian average is applied. A 4.6 from 50 ratings still outranks a 4.4 from 500 ratings. The higher floor is the control for that.",
                f"- {summary['eligible50']:,} movies clear 50 ratings, and {summary['eligible150']:,} clear 150{full_top}.",
            ]
        )
    )
    st.subheader("How the charts are drawn")
    st.markdown(
        "\n".join(
            [
                "- Genre bars are sorted by movie count or by mean rating, with the largest value at the top. The time chart runs from earlier release years to later ones. Neither chart is alphabetical.",
                "- Movie-count bars start at zero. Mean-rating charts use a narrowed scale around the values on screen so gaps on the 1–5 scale stay visible. The axis title names that full scale.",
                "- The two top-5 charts share one scale, so a longer bar is a higher mean in both panels.",
            ]
        )
    )


def main():
    st.set_page_config(page_title="Movie ratings", layout="wide")
    st.title("What got rated, and how those ratings landed")
    st.caption("Every chart and the sentences under them are calculated from the ratings file.")

    if not Path(DATA_PATH).exists():
        st.error(f"Could not find the ratings file at {DATA_PATH}.")
        return

    result = load_dashboard(str(DATA_PATH))
    summary = result["summary"]
    column1, column2, column3, column4 = st.columns(4)
    column1.metric("Ratings", f"{summary['total_ratings']:,}")
    column2.metric("Movies", f"{summary['total_movies']:,}")
    column3.metric("People", f"{summary['total_users']:,}")
    column4.metric("Release years", f"{summary['year_min']}–{summary['year_max']}")

    st.header(QUESTIONS["q1"])
    st.altair_chart(genre_chart(result["genres"]), width="stretch")
    st.write(summary["q1"])

    st.header(QUESTIONS["q2"])
    st.altair_chart(satisfaction_chart(result["satisfaction"]), width="stretch")
    low, high = _mean_domain(result["satisfaction"]["mean"])
    st.caption(
        f"The scale runs from {low:.1f} to {high:.1f} so differences on the 1–5 scale stay visible."
    )
    st.write(summary["q2"])

    st.header(QUESTIONS["q3"])
    st.altair_chart(year_chart(result["years"]), width="stretch")
    st.caption("Hover a year for its mean, rating count, and movie count. Gaps are release years with no rated movies.")
    st.write(summary["q3"])

    st.header(QUESTIONS["q4"])
    shared = _mean_domain(list(result["top50"]["mean"]) + list(result["top150"]["mean"]))
    left, right = st.columns(2)
    with left:
        st.subheader("At least 50 ratings")
        movie_chart(result["top50"], shared)
    with right:
        st.subheader("At least 150 ratings")
        movie_chart(result["top150"], shared)
    st.caption(
        f"Both charts use the same scale, from {shared[0]:.2f} to {shared[1]:.2f} on the 1–5 rating scale."
    )
    st.write(summary["q4"])
    st.markdown("**What changed**")
    st.write(summary["q4_note"])

    methodology(summary, result["genres"])


if __name__ == "__main__":
    main()
