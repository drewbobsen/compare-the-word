use axum::{
    extract::{Query, State},
    routing::get,
    http::StatusCode,
    Router,
    Json
};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use sqlx::FromRow;
use dotenvy::dotenv;
use std::env;
use tower_http::cors::{Any, CorsLayer};

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

#[tokio::main]
async fn main() {
    dotenv().ok();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set in the .envfile");

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Connecting to the database...");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

        let app = Router::new()
            .route("/api/compare", get(compare_verses))
            .route("/api/translations", get(get_translations))
            .route("/api/books", get(get_books))
            .with_state(pool)
            .layer(cors);

        let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
        println!("Server running! Try fetching: {addr}/api/compare?book=Genesis&chapter=1&verse=1");
        axum::serve(listener, app).await.unwrap();
}

pub async fn compare_verses(
    State(pool): State<PgPool>,
    Query(query_params): Query<CompareQuery>,
) -> Result<Json<Vec<VerseResponse>>, (StatusCode, String)> {
    let verses = sqlx::query_as::<_, VerseResponse>(
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
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(verses))
}

pub async fn get_translations(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<TranslationResponse>>, (StatusCode, String)> {
    let translations = sqlx::query_as::<_, TranslationResponse>(
        "SELECT code, name FROM translations ORDER BY name ASC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(translations))
}

pub async fn get_books(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<BookInfo>>, (StatusCode, String)> {
    let books = sqlx::query_as::<_, BookInfo>(
        "SELECT book, COALESCE(MAX(chapter), 1)::INT AS chapter_count FROM verses GROUP BY book"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(books))
}
