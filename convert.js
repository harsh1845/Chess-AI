// convert.js

const fs = require('fs');
const csv = require('csv-parser');

// --- Configuration ---
const inputFile = 'openings_fen7.csv';  // The name of your CSV file
const outputFile = 'opening_book.js';   // The name of the JS file we will create
// -------------------

const openingBook = {};
let movesForBlack = 0;

console.log(`Reading from ${inputFile}...`);

fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
        // Get the data from the columns
        const fen = row.fen;
        const bestMove = row.best_move;

        // FEN strings have parts separated by spaces. The second part is the active player.
        // We only want to create book entries for positions where it is Black's turn.
        const fenParts = fen.split(' ');

        if (fenParts.length > 1) {
            const activePlayer = fenParts[1];
            if (activePlayer === 'b') {
                // This is a move for Black (our AI), so we add it to our book.

                // IMPORTANT: We use a simplified FEN for the key to avoid issues
                // with move clocks. This makes the book much more reliable.
                const fenKey = fenParts.slice(0, 4).join(' '); // e.g. "board b KQkq -"

                openingBook[fenKey] = bestMove;
                movesForBlack++;
            }
        }
    })
    .on('end', () => {
        // Now that we have the complete book object, format it for the .js file.
        // JSON.stringify with a spacer of 2 makes the file readable.
        const fileContent = `const openingBook = ${JSON.stringify(openingBook, null, 2)};`;

        fs.writeFile(outputFile, fileContent, (err) => {
            if (err) {
                return console.error('Error writing file:', err);
            }
            console.log(`\nConversion complete!`);
            console.log(`${movesForBlack} moves for Black have been written to ${outputFile}.`);
            console.log(`\nYou can now replace the old opening_book.js in your chess project with this new one.`);
        });
    });