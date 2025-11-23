/**
 * Monopoly Service — Updated with /games endpoints for Homework 3
 */

import express from 'express';
import pgPromise from 'pg-promise';
import cors from 'cors';

// Import types for compile-time checking.
import type { Request, Response, NextFunction } from 'express';
import type { Player, PlayerInput } from './player.js';


// Set up the database
const db = pgPromise()({
    host: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT as string) || 5432,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Configure the server and its routes
const app = express();
const port: number = parseInt(process.env.PORT as string) || 3000;
const router = express.Router();
app.use(cors({
  origin: ["http://localhost:8081", "http://localhost:19006"],
}));


router.use(express.json());
router.get('/', readHello);

/** Player endpoints **/
router.get('/players', readPlayers);
router.get('/players/:id', readPlayer);
router.put('/players/:id', updatePlayer);
router.post('/players', createPlayer);
router.delete('/players/:id', deletePlayer);

/** NEW — Game endpoints required for Homework 3 **/
router.get('/games', readGames);
router.get('/games/:id', readGamePlayers);
router.delete('/games/:id', deleteGame);

app.use(router);

// Custom error handler - must be defined AFTER all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({
        error: 'An internal server error occurred'
    });
});

app.listen(port, (): void => {
    console.log(`Listening on port ${port}`);
});

/**
 * Utility function: returns data or 404 if null.
 */
function returnDataOr404(response: Response, data: unknown): void {
    if (data == null) {
        response.sendStatus(404);
    } else {
        response.send(data);
    }
}

/**
 * Basic hello-world endpoint.
 */
function readHello(_request: Request, response: Response): void {
    response.send('Hello, CS 262 Monopoly service!');
}

/* =
   PLAYER CRUD FUNCTIONS
   */

/**
 * Retrieves all players.
 */
function readPlayers(_request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Player')
        .then((data: Player[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * Retrieves one player by ID.
 */
function readPlayer(request: Request, response: Response, next: NextFunction): void {
    db.oneOrNone('SELECT * FROM Player WHERE id=${id}', request.params)
        .then((data: Player | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * Updates a player.
 */
function updatePlayer(request: Request, response: Response, next: NextFunction): void {
    db.oneOrNone(
        'UPDATE Player SET email=${body.email}, name=${body.name} WHERE id=${params.id} RETURNING id',
        {
            params: request.params,
            body: request.body as PlayerInput
        }
    )
        .then((data: { id: number } | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * Creates a player.
 */
function createPlayer(request: Request, response: Response, next: NextFunction): void {
    db.one(
        'INSERT INTO Player(email, name) VALUES (${email}, ${name}) RETURNING id',
        request.body as PlayerInput
    )
        .then((data: { id: number }): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * Deletes a player and its PlayerGame rows.
 */
function deletePlayer(request: Request, response: Response, next: NextFunction): void {
    db.tx((t) => {
        return t.none('DELETE FROM PlayerGame WHERE playerID=${id}', request.params)
            .then(() => {
                return t.oneOrNone(
                    'DELETE FROM Player WHERE id=${id} RETURNING id',
                    request.params
                );
            });
    })
        .then((data: { id: number } | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/* =
   NEW — GAME ENDPOINTS FOR HOMEWORK 3
   = */

/**
 * GET /games — returns all games.
 */
function readGames(_request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Game ORDER BY id')
        .then((data): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * GET /games/:id — returns players + scores for that game.
 */
function readGamePlayers(request: Request, response: Response, next: NextFunction): void {
    const sql = `
        SELECT Player.id, Player.name, Player.email, PlayerGame.score
        FROM PlayerGame
        JOIN Player ON Player.id = PlayerGame.playerID
        WHERE PlayerGame.gameID = $1
        ORDER BY PlayerGame.playerID
    `;

    db.manyOrNone(sql, [request.params.id])
        .then((data): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * DELETE /games/:id — deletes a game and its dependent rows.
 */
function deleteGame(request: Request, response: Response, next: NextFunction): void {
    db.tx((t) => {
        return t.none('DELETE FROM PlayerGame WHERE gameID=${id}', request.params)
            .then(() => {
                return t.oneOrNone(
                    'DELETE FROM Game WHERE id=${id} RETURNING id',
                    request.params
                );
            });
    })
        .then((data): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}
