
# Reproduction Guide
## Failing commit
`All tests passed`
## Steps to reproduce
1. Create the collection
```bash
curl "http://localhost:8108/collections" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz" \
    -d '{"name":"songs","fields":[{"name":"album_name","type":"string"},{"name":"country","type":"string","facet":true},{"name":"genres","type":"string[]","facet":true},{"name":"primary_artist_name","type":"string","facet":true},{"name":"release_date","type":"int64"},{"name":"release_decade","type":"string","facet":true},{"name":"release_group_types","type":"string[]","facet":true},{"name":"title","type":"string"},{"name":"track_id","type":"string"},{"name":"urls","type":"object[]","optional":true}],"enable_nested_fields":true}'
```
2. Download the dataset from [here](https://dl.typesense.org/datasets/musicbrainz-1M-songs.jsonl.tar.gz)
3. Index the dataset
```bash
curl "http://localhost:8108/collections/songs/documents/import" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz" \
    --data-binary @musicbrainz-1M-songs.jsonl
```
  
4. Run the passing test benchmark scenarios
## Passing Scenarios

### facet
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "facet_by": "genres,country,release_decade"
}
```
### Curl Request
```bash
# 100 VUs: 1343ms vs 1313ms (2.285%)
# 50 VUs: 695ms vs 710ms (-2.113%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&facet_by=genres%2Ccountry%2Crelease_decade" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### filter_complex
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "filter_by": "genres:Rock && primary_artist_name:Queen || primary_artist_name:Led Zeppelin"
}
```
### Curl Request
```bash
# 100 VUs: 43ms vs 41ms (4.878%)
# 50 VUs: 23ms vs 20ms (15%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&filter_by=genres%3ARock+%26%26+primary_artist_name%3AQueen+%7C%7C+primary_artist_name%3ALed+Zeppelin" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### filter_simple
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "filter_by": "genres:Rock"
}
```
### Curl Request
```bash
# 100 VUs: 452ms vs 510ms (-11.373%)
# 50 VUs: 189ms vs 202ms (-6.436%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&filter_by=genres%3ARock" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### group
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "group_by": "genres"
}
```
### Curl Request
```bash
# 100 VUs: 2823ms vs 2761ms (2.246%)
# 50 VUs: 1427ms vs 1421ms (0.422%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&group_by=genres" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### just_q
### Search Parameters
```json
{
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name"
}
```
### Curl Request
```bash
# 100 VUs: 7ms vs 7ms (0%)
# 50 VUs: 7ms vs 8ms (-12.500%)
curl "http://localhost:8108/collections/songs/documents/search?query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### q_star
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name"
}
```
### Curl Request
```bash
# 100 VUs: 0ms vs 0ms (0%)
# 50 VUs: 0ms vs 0ms (0%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### sort_eval_condition
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "sort_by": "_eval(primary_artist_name:Queen):desc, release_date:desc"
}
```
### Curl Request
```bash
# 100 VUs: 1054ms vs 923ms (14.193%)
# 50 VUs: 512ms vs 484ms (5.785%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&sort_by=_eval%28primary_artist_name%3AQueen%29%3Adesc%2C+release_date%3Adesc" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### sort_eval_score
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "sort_by": "_eval([(primary_artist_name:Queen):3, (primary_artist_name:Nirvana):5]):desc, release_date:desc"
}
```
### Curl Request
```bash
# 100 VUs: 1094ms vs 1184ms (-7.601%)
# 50 VUs: 582ms vs 619ms (-5.977%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&sort_by=_eval%28%5B%28primary_artist_name%3AQueen%29%3A3%2C+%28primary_artist_name%3ANirvana%29%3A5%5D%29%3Adesc%2C+release_date%3Adesc" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
### sort_simple
### Search Parameters
```json
{
  "q": "*",
  "query_by": "primary_artist_name,title,album_name",
  "highlight_full_fields": "primary_artist_name,title,album_name",
  "sort_by": "release_date:desc"
}
```
### Curl Request
```bash
# 100 VUs: 854ms vs 1086ms (-21.363%)
# 50 VUs: 451ms vs 460ms (-1.957%)
curl "http://localhost:8108/collections/songs/documents/search?q=*&query_by=primary_artist_name%2Ctitle%2Calbum_name&highlight_full_fields=primary_artist_name%2Ctitle%2Calbum_name&sort_by=release_date%3Adesc" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "X-TYPESENSE-API-KEY: xyz"
```
5. Run the failing test benchmark scenarios
## Failing Scenarios
