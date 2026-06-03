import psycopg2

conn = psycopg2.connect('postgresql://postgres:oWKEhgBeXsSDgsTBOgtHkGYNMkldQuGq@zephyr.proxy.rlwy.net:53824/railway')
conn.autocommit = True
cur = conn.cursor()

print('Dropping table...')
cur.execute('DROP TABLE IF EXISTS yellow_taxi_trips')

print('Vacuuming...')
cur.execute('VACUUM FULL')

print('Checking size...')
cur.execute("SELECT pg_size_pretty(pg_database_size('railway'))")
print('DB size:', cur.fetchone()[0])

cur.close()
conn.close()
print('Done!')