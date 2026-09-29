import re
from pathlib import Path

import pandas as pd

YEAR_IN_TITLE = re.compile(r"\((\d{4})\)")
DATA_PATH = Path(__file__).resolve().parent / "movie_ratings.csv"


def _fmt_int(value):
    return f"{int(value):,}"


def _fmt_mean(value):
    return f"{float(value):.2f}"


def _plural(count, singular, plural_form=None):
    word = singular if int(count) == 1 else (plural_form or f"{singular}s")
    return f"{_fmt_int(count)} {word}"


def _join(items):
    items = list(items)
    if len(items) <= 1:
        return items[0] if items else ""
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f", and {items[-1]}"


def _quote(text):
    return f"“{text}”"


def _release_year(year_value, title):
    if pd.notna(year_value) and str(year_value).strip() != "":
        return int(float(year_value))
    match = YEAR_IN_TITLE.search("" if pd.isna(title) else str(title))
    return int(match.group(1)) if match else pd.NA


def _split_genres(value):
    seen = []
    for part in str(value).split("|"):
        genre = part.strip()
        if genre and genre not in seen:
            seen.append(genre)
    return seen


def _trend_per_decade(years):
    weight = years["ratings"].to_numpy(dtype=float)
    x_values = years["year"].to_numpy(dtype=float)
    y_values = years["mean"].to_numpy(dtype=float)
    total_weight = weight.sum()
    sum_x = (weight * x_values).sum()
    sum_y = (weight * y_values).sum()
    sum_xx = (weight * x_values * x_values).sum()
    sum_xy = (weight * x_values * y_values).sum()
    denominator = total_weight * sum_xx - sum_x * sum_x
    if denominator == 0:
        return 0.0
    return float((total_weight * sum_xy - sum_x * sum_y) / denominator * 10)


def _rank_movies(movies, floor):
    ranked = movies.loc[movies["rating_count"] >= floor].copy()
    ranked["mean"] = ranked["rating_sum"] / ranked["rating_count"]
    ranked = ranked.sort_values(
        ["mean", "rating_count", "movie_id"],
        ascending=[False, False, True],
    ).head(5)
    ranked = ranked.reset_index(drop=True)
    ranked["rank"] = ranked.index + 1
    ranked["count"] = ranked["rating_count"].astype(int)
    return ranked[["rank", "movie_id", "title", "release_year", "mean", "count"]]


def _matching_mean(frame, mean):
    label = _fmt_mean(mean)
    return frame.loc[frame["mean"].map(_fmt_mean).eq(label)]


def genre_breakdown_takeaway(genres, total_movies):
    leader = genres.iloc[0]
    tied = genres.loc[genres["movies"].eq(leader["movies"])]
    share_sum = float(genres["share"].sum())
    if len(tied) == 1:
        opening = (
            f"{leader['genre']} is listed on {_fmt_int(leader['movies'])} of "
            f"{_fmt_int(total_movies)} movies ({round(float(leader['share']) * 100)}%)."
        )
    else:
        opening = (
            f"{_join(tied['genre'])} are each listed on {_fmt_int(leader['movies'])} of "
            f"{_fmt_int(total_movies)} movies."
        )
    if share_sum > 1.001:
        overlap = (
            "A movie is counted in every genre it lists, so the percentages add up to "
            f"{round(share_sum * 100)}%."
        )
    else:
        overlap = "Each movie lists one genre, so the percentages add up to 100%."
    return f"{opening} {overlap}"


def _satisfaction_clause(groups, extreme):
    if len(groups) == 1:
        genre = groups.iloc[0]
        return (
            f"{extreme} average rating is {genre['genre']} at {_fmt_mean(genre['mean'])}, "
            f"across {_fmt_int(genre['ratings'])} ratings"
        )
    names = [
        f"{row.genre} ({_fmt_int(row.ratings)} ratings)" for row in groups.itertuples(index=False)
    ]
    return (
        f"{extreme} average rating is shared by {_join(names)}, all at "
        f"{_fmt_mean(groups.iloc[0]['mean'])} when rounded to two decimals"
    )


def satisfaction_takeaway(genres):
    highest = _matching_mean(genres, genres.iloc[0]["mean"])
    lowest = _matching_mean(genres, genres.iloc[-1]["mean"])
    if _fmt_mean(highest.iloc[0]["mean"]) == _fmt_mean(lowest.iloc[0]["mean"]):
        return f"Every genre rounds to the same average rating, {_fmt_mean(highest.iloc[0]['mean'])}."
    return (
        f"{_satisfaction_clause(highest, 'The highest')}. "
        f"{_satisfaction_clause(lowest, 'The lowest')}."
    )


def _year_detail(year):
    movie_word = "movie" if int(year["movies"]) == 1 else "movies"
    return (
        f"{int(year['year'])} ({_fmt_mean(year['mean'])}, {_fmt_int(year['ratings'])} ratings "
        f"of {_fmt_int(year['movies'])} {movie_word})"
    )


def _extreme_years(years):
    if len(years) <= 3:
        return _join(_year_detail(row) for _, row in years.iterrows())
    shown = [_year_detail(row) for _, row in years.head(2).iterrows()]
    rest = len(years) - len(shown)
    return (
        f"{' and '.join(shown)}, and {rest} more years, all {_fmt_mean(years.iloc[0]['mean'])} "
        "when rounded to two decimals"
    )


def time_takeaway(years, per_decade):
    highest = _matching_mean(years, years["mean"].max())
    lowest = _matching_mean(years, years["mean"].min())
    opening = (
        f"Mean rating peaks for movies released in {_extreme_years(highest)} "
        f"and is lowest for {_extreme_years(lowest)}."
    )
    start = int(years.iloc[0]["year"])
    end = int(years.iloc[-1]["year"])
    magnitude = abs(per_decade)
    amount = "less than 0.01 points per decade" if magnitude < 0.005 else f"{magnitude:.2f} points per decade"
    if magnitude < 0.03:
        trend = (
            "Giving busier years more weight, a straight line through these yearly averages "
            f"barely moves between {start} and {end} (about {amount})."
        )
    else:
        direction = "rises" if per_decade > 0 else "falls"
        trend = (
            "Giving busier years more weight, a straight line through these yearly averages "
            f"{direction} by about {amount} between {start} and {end}."
        )
    return f"{opening} {trend}"


def best_takeaway(top50, top150):
    if top50.empty:
        return "No movie has at least 50 ratings."
    leader = top50.iloc[0]
    if top150.empty:
        return (
            f"{_quote(leader['title'])} leads the movies with at least 50 ratings, with a mean of "
            f"{_fmt_mean(leader['mean'])} from {_fmt_int(leader['count'])} ratings. "
            "No movie reaches 150 ratings."
        )
    leader150 = top150.iloc[0]
    if int(leader["movie_id"]) == int(leader150["movie_id"]):
        return (
            f"{_quote(leader['title'])} is first at both floors, with a mean of "
            f"{_fmt_mean(leader['mean'])} from {_fmt_int(leader['count'])} ratings. "
            "Raising the floor from 50 to 150 does not change who ranks first."
        )
    return (
        f"{_quote(leader['title'])} is first when a movie needs at least 50 ratings, with a mean of "
        f"{_fmt_mean(leader['mean'])} from {_fmt_int(leader['count'])} ratings. "
        f"At 150 ratings, {_quote(leader150['title'])} ranks first instead, with a mean of "
        f"{_fmt_mean(leader150['mean'])} from {_fmt_int(leader150['count'])} ratings."
    )


def floor_change_note(top50, top150, eligible50, eligible150):
    pool = (
        f"{_fmt_int(eligible50)} movies have at least 50 ratings. "
        f"{_fmt_int(eligible150)} still have at least 150."
    )
    if top50.empty or top150.empty:
        return pool
    ids150 = set(top150["movie_id"].astype(int))
    ids50 = set(top50["movie_id"].astype(int))
    dropped = top50.loc[~top50["movie_id"].astype(int).isin(ids150)]
    added = top150.loc[~top150["movie_id"].astype(int).isin(ids50)]
    same_order = list(top50["movie_id"].astype(int)) == list(top150["movie_id"].astype(int))
    if same_order:
        return f"{pool} The top 5 names, and their order, stay the same when the floor rises to 150."
    if dropped.empty and added.empty:
        if int(top50.iloc[0]["movie_id"]) == int(top150.iloc[0]["movie_id"]):
            lead = "The same five movies qualify at both floors, but not in the same order."
        else:
            lead = (
                "The same five movies qualify at both floors, with "
                f"{_quote(top150.iloc[0]['title'])} moving into first place."
            )
        return f"{pool} {lead}"
    parts = []
    if not dropped.empty:
        parts.append(f"removes {_join(_quote(title) for title in dropped['title'])}")
    if not added.empty:
        parts.append(f"brings in {_join(_quote(title) for title in added['title'])}")
    return f"{pool} Raising the floor from 50 to 150 {' and '.join(parts)}."


def counting_note(result):
    if result["duplicate_pairs"] == 0:
        repeats = "No person rated the same movie more than once, so each row is one rating."
    else:
        repeats = (
            f"{_plural(result['duplicate_pairs'], 'user-movie pair')} appeared more than once; "
            "each row is still counted separately."
        )
    skipped = ""
    if result["skipped_rows"]:
        verb = "was" if result["skipped_rows"] == 1 else "were"
        skipped = f" {_plural(result['skipped_rows'], 'row')} could not be read as a rating and {verb} skipped."
    return (
        "Each row is one person’s rating of one movie, and movies are grouped by movie id so remakes stay separate. "
        f"{repeats}{skipped} Ratings in this file run from {int(result['rating_min'])} to {int(result['rating_max'])}. "
        "Averages are the mean of rating rows, so a heavily rated movie pulls more than a movie with one rating."
    )


def year_rule_note(result):
    if result["movies_year_from_title"] == 0:
        filled = "Every movie already had a release year in the year column."
    else:
        filled = (
            "The title supplied a release year for "
            f"{_plural(result['movies_year_from_title'], 'movie')} "
            f"({_plural(result['ratings_year_from_title'], 'rating')}) whose year column was blank."
        )
    if result["movies_without_year"] == 0:
        missing = "No rated movie was missing a release year."
    else:
        verb = "it is" if result["movies_without_year"] == 1 else "they are"
        missing = (
            f"{_plural(result['movies_without_year'], 'movie')} "
            f"({_plural(result['ratings_without_year'], 'rating')}) had no year in the column or the title, "
            f"so {verb} left out of the time chart."
        )
    return f"{filled} {missing}"


def compute_dashboard(path=DATA_PATH):
    ratings = pd.read_csv(path)
    ratings["rating"] = pd.to_numeric(ratings["rating"], errors="coerce")
    skipped_rows = int(ratings["rating"].isna().sum() + ratings["movie_id"].isna().sum())
    ratings = ratings.dropna(subset=["rating", "movie_id"]).copy()
    ratings["movie_id"] = ratings["movie_id"].astype(int)
    ratings["title"] = ratings["title"].fillna("").str.strip()

    pair_sizes = ratings.groupby(["user_id", "movie_id"], sort=False).size()
    duplicate_pairs = int((pair_sizes > 1).sum())

    first = ratings.groupby("movie_id", sort=False).first().reset_index()
    totals = ratings.groupby("movie_id", sort=False)["rating"].agg(rating_sum="sum", rating_count="size")
    movies = first.merge(totals, on="movie_id")
    raw_year_blank = movies["year"].isna() | movies["year"].astype(str).str.strip().eq("")
    movies["release_year"] = [
        _release_year(year, title) for year, title in zip(movies["year"], movies["title"])
    ]
    movies["release_year"] = pd.to_numeric(movies["release_year"], errors="coerce")
    movies["year_from_title"] = raw_year_blank & movies["release_year"].notna()
    movies["genres"] = movies["genres"].map(_split_genres)

    genre_rows = movies.explode("genres").rename(columns={"genres": "genre"})
    genres = (
        genre_rows.groupby("genre", sort=False)
        .agg(
            movies=("movie_id", "nunique"),
            ratings=("rating_count", "sum"),
            rating_sum=("rating_sum", "sum"),
        )
        .reset_index()
    )
    total_movies = int(movies["movie_id"].nunique())
    genres["share"] = genres["movies"] / total_movies
    genres = genres.sort_values(["movies", "ratings"], ascending=[False, False]).reset_index(drop=True)
    genres["order"] = genres.index

    satisfaction = genres.loc[genres["genre"].ne("unknown")].copy()
    satisfaction["mean"] = satisfaction["rating_sum"] / satisfaction["ratings"]
    satisfaction = satisfaction.sort_values(
        ["mean", "ratings", "movies"],
        ascending=[False, False, False],
    ).reset_index(drop=True)
    satisfaction["order"] = satisfaction.index

    dated = movies.loc[movies["release_year"].notna()].copy()
    years = (
        dated.groupby("release_year", sort=True)
        .agg(
            movies=("movie_id", "nunique"),
            ratings=("rating_count", "sum"),
            rating_sum=("rating_sum", "sum"),
        )
        .reset_index()
        .rename(columns={"release_year": "year"})
    )
    years["year"] = years["year"].astype(int)
    years["mean"] = years["rating_sum"] / years["ratings"]
    years["segment"] = years["year"].diff().fillna(1).ne(1).cumsum()

    top50 = _rank_movies(movies, 50)
    top150 = _rank_movies(movies, 150)
    eligible50 = int((movies["rating_count"] >= 50).sum())
    eligible150 = int((movies["rating_count"] >= 150).sum())
    per_decade = _trend_per_decade(years)

    summary = {
        "total_ratings": int(len(ratings)),
        "total_users": int(ratings["user_id"].nunique()),
        "total_movies": total_movies,
        "rating_min": int(ratings["rating"].min()),
        "rating_max": int(ratings["rating"].max()),
        "duplicate_pairs": duplicate_pairs,
        "skipped_rows": skipped_rows,
        "movies_year_from_title": int(movies["year_from_title"].sum()),
        "ratings_year_from_title": int(movies.loc[movies["year_from_title"], "rating_count"].sum()),
        "movies_without_year": int(movies["release_year"].isna().sum()),
        "ratings_without_year": int(movies.loc[movies["release_year"].isna(), "rating_count"].sum()),
        "year_min": int(years.iloc[0]["year"]),
        "year_max": int(years.iloc[-1]["year"]),
        "trend_per_decade": per_decade,
        "eligible50": eligible50,
        "eligible150": eligible150,
    }
    summary["q1"] = genre_breakdown_takeaway(genres, total_movies)
    summary["q2"] = satisfaction_takeaway(satisfaction)
    summary["q3"] = time_takeaway(years, per_decade)
    summary["q4"] = best_takeaway(top50, top150)
    summary["q4_note"] = floor_change_note(top50, top150, eligible50, eligible150)
    summary["counting_note"] = counting_note(summary)
    summary["year_note"] = year_rule_note(summary)
    return {
        "summary": summary,
        "genres": genres,
        "satisfaction": satisfaction,
        "years": years,
        "top50": top50,
        "top150": top150,
    }
