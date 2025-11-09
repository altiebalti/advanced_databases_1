This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000/api/users](http://localhost:3000/api/users) with your browser to see the result.



## Database (PostgreSQL via Docker)

Quick commands:

```bash
# start Postgres (builds an image that includes setup.sql)
yarn db:up

# apply/re-apply setup.sql into the running DB
yarn db:setup

# view DB logs
yarn db:logs

# stop and remove containers and volumes
yarn db:down
```

Notes:
- The first `yarn db:up` initializes the database and runs `setup.sql` automatically during container init.
- `yarn db:setup` can be used any time to re-run `setup.sql` against the running DB.
