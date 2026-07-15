use axum::{
    extract::{Query, State},
    routing::get,
    http::header,
    response::IntoResponse,
    http::StatusCode,
    Router,
    Json,
};
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use sqlx::FromRow;
use dotenvy::dotenv;
use std::env;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use similar::{ChangeTag, TextDiff};
// 1. Define the shared Application State
#[derive(Serialize, Clone)]
pub struct DiffToken {
    pub text: String,
    pub has_diff: bool,
}

#[derive(Serialize)]
pub struct VerseDiffResponse {
    pub verse: i32,
    pub text_1: Vec<DiffToken>,
    pub text_2: Vec<DiffToken>,
}

#[derive(Clone)]
struct AppState {
    db: PgPool,
    cache: Cache<String, String>,
}

#[derive(Deserialize)]
struct CompareQuery {
    book: String,
    chapter: i32,
    pub t1: String,
    pub t2: String,
}

#[derive(Serialize, FromRow)]
pub struct VerseResponse {
    pub verse: i32,
    pub text_1: Option<String>,
    pub text_2: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct TranslationResponse {
    pub code: String,
    pub name: String,
}

#[derive(Serialize, FromRow)]
pub struct BookInfo {
    pub book: String,
    pub chapter_count: i32,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub t: Option<String>, // Optional translation filter
}

#[derive(Serialize, FromRow)]
pub struct SearchResult {
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
    pub highlight: Option<String>, 
}

use std::sync::Arc;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
        
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set in the .envfile");

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Connecting to the database...");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // 2. Initialize the Moka Cache
    let query_cache = Cache::builder()
        .max_capacity(1_000) // Caps at 1,000 queries to protect RAM
        .time_to_idle(Duration::from_secs(86_400)) // 24-hour idle expiration
        .build();

    // 3. Bundle the pool and cache into our AppState
    let state = AppState {
        db: pool,
        cache: query_cache,
    };

    let app = Router::new()
        .route("/api/compare", get(compare_verses))
        .route("/api/translations", get(get_translations))
        .route("/api/books", get(get_books))
        .route("/api/search", get(search_verses))
        .with_state(state) // Pass the combined state here
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Server running! Try fetching: {addr}/api/compare?book=Genesis&chapter=1&t1=eng-kjv&t2=eng-web");
    axum::serve(listener, app).await.unwrap();
}

// 4. The highly optimized cache handler
pub async fn compare_verses(
    State(state): State<AppState>,
    Query(query_params): Query<CompareQuery>,
) -> impl IntoResponse {
    // Generate a unique key based on the query parameters
    let cache_key = format!(
        "{}:{}:{}:{}", 
        query_params.book, query_params.chapter, query_params.t1, query_params.t2
    );

    // CHECK CACHE: If the JSON string exists, serve it immediately
    if let Some(cached_json) = state.cache.get(&cache_key).await {
        println!("Cache HIT: {}", cache_key);
        return (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "application/json")],
            cached_json,
        ).into_response();
    }

    println!("Cache MISS: {} - Querying Database...", cache_key);

    // DATABASE QUERY
    let query_result = sqlx::query_as::<_, VerseResponse>(
        r#"
        SELECT 
            verse,
            MAX(CASE WHEN translation_code = $3 THEN text END) AS text_1,
            MAX(CASE WHEN translation_code = $4 THEN text END) AS text_2
        FROM verses
        WHERE book = $1 AND chapter = $2 AND translation_code IN ($3, $4)
        GROUP BY verse
        ORDER BY verse ASC;
        "#
    )
    .bind(&query_params.book)
    .bind(query_params.chapter)
    .bind(&query_params.t1)
    .bind(&query_params.t2)
    .fetch_all(&state.db) // Note: using state.db now
    .await;

    // Handle potential database errors gracefully
    let verses = match query_result {
        Ok(v) => v,
        Err(e) => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            [(header::CONTENT_TYPE, "text/plain")],
            format!("Database error: {}", e),
        ).into_response(),
    };

    let mut diffed_verses = Vec::new();

    for v in verses{
        let t1_raw = v.text_1.as_deref().unwrap_or("");
        let t2_raw = v.text_2.as_deref().unwrap_or("");

        let diff = TextDiff::from_words(t1_raw, t2_raw);

        let mut text_1_tokens = Vec::new();
        let mut text_2_tokens = Vec::new();

        for change in diff.iter_all_changes(){
            let token = DiffToken{
                text: change.value().to_string(),
                has_diff: change.tag() != ChangeTag::Equal,
            };

            match change.tag() {
                ChangeTag::Equal => {
                    text_1_tokens.push(token.clone());
                    text_2_tokens.push(token);
                }
                ChangeTag::Delete => {
                    text_1_tokens.push(token);
                }
                ChangeTag::Insert => {
                    text_2_tokens.push(token);
                }
            }
        }

        diffed_verses.push(VerseDiffResponse {
            verse: v.verse,
            text_1: text_1_tokens,
            text_2: text_2_tokens,
        });
    }

    let json_string = match serde_json::to_string(&diffed_verses) {
        Ok(s) => s,
        Err(e) => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            [(header::CONTENT_TYPE, "text/plain")],
            format!("Serialization error: {}", e),
        ).into_response(),
    };

    // STORE IN CACHE
    state.cache.insert(cache_key, json_string.clone()).await;

    // RETURN TO CLIENT
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json")],
        json_string,
    ).into_response()
}

// 5. Update the state extractors for the remaining routes
pub async fn get_translations(
    State(state): State<AppState>,
) -> Result<Json<Vec<TranslationResponse>>, (StatusCode, String)> {
    let translations = sqlx::query_as::<_, TranslationResponse>(
        "SELECT code, name FROM translations ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(translations))
}

pub async fn get_books(
    State(state): State<AppState>,
) -> Result<Json<Vec<BookInfo>>, (StatusCode, String)> {
    let books = sqlx::query_as::<_, BookInfo>(
        "SELECT book, COALESCE(MAX(chapter), 1)::INT AS chapter_count FROM verses GROUP BY book"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(books))
}

pub async fn search_verses(
    State(state): State<AppState>, // Your Axum state containing the SQLx PgPool
    Query(params): Query<SearchQuery>,
) -> impl IntoResponse {
    // 1. Sanitize input
    let search_term = params.q.trim();
    if search_term.is_empty() {
        return (StatusCode::BAD_REQUEST, "Search query cannot be empty").into_response();
    }

    let translation = params.t.unwrap_or_else(|| "kjv".to_string()).to_lowercase();

    // 2. Execute the Full-Text Search
    // plainto_tsquery ensures things like "the light" don't break the SQL syntax
    let query_result = sqlx::query_as::<_, SearchResult>(
        r#"
        SELECT 
            book, 
            chapter, 
            verse, 
            text,
            ts_headline('english', text, plainto_tsquery('english', $2), 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') as highlight
        FROM verses
        WHERE translation_code = $1 
          AND search_vector @@ plainto_tsquery('english', $2)
        ORDER BY book ASC, chapter ASC, verse ASC
        LIMIT 50
        "#
    )
    .bind(&translation)
    .bind(search_term)
    .fetch_all(&state.db)
    .await;

    // 3. Return the JSON payload
    match query_result {
        Ok(results) => (StatusCode::OK, Json(results)).into_response(),
        Err(e) => {
            eprintln!("Database search error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to execute search").into_response()
        }
    }
}