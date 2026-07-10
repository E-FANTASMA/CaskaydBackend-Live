require('dotenv').config();

const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const counts = await client.query(`
      select
        (select count(1) from "Category") as categories,
        (select count(1) from "CampaignIntent") as campaign_intents,
        (select count(1) from "CreatorSecondaryCategory") as creator_secondary_categories
    `);

    const creatorColumns = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'Creator'
      order by ordinal_position
    `);

    console.log(
      JSON.stringify(
        {
          counts: counts.rows[0],
          creatorColumns: creatorColumns.rows.map((row) => row.column_name),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
