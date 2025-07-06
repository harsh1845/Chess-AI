# convert.py

import csv
import json

# --- Configuration ---
input_file = 'openings_fen7.csv'
output_file = 'opening_book.js'
# -------------------

opening_book = {}

print(f"Starting conversion of {input_file}...")

try:
    with open(input_file, mode='r', newline='', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        for row in reader:
            fen = row.get('fen')
            best_move = row.get('best_move')
            
            if not fen or not best_move:
                continue

            # The 2nd part of the FEN string is the active player ('w' or 'b')
            fen_parts = fen.split(' ')
            if len(fen_parts) > 1 and fen_parts[1] == 'b':
                # This is a move for Black (our AI), so add it.
                opening_book[fen] = best_move

    # Write the opening book to the JavaScript file
    with open(output_file, mode='w', encoding='utf-8') as outfile:
        # Use json.dumps for pretty printing, then assign to a JS const
        js_object_string = json.dumps(opening_book, indent=2)
        outfile.write(f"const openingBook = {js_object_string};")

    print(f"\nConversion complete!")
    print(f"{len(opening_book)} moves for Black have been written to {output_file}.")
    print(f"You can now replace the old opening_book.js in your project with this new one.")

except FileNotFoundError:
    print(f"Error: The file '{input_file}' was not found.")
except Exception as e:
    print(f"An error occurred: {e}")