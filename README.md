# strudel-batch-cli

CLI tool for batch processing multiple audio files to Strudel live coding patterns.

## Features

- **Batch Processing**: Process multiple audio files at once
- **Customizable Output**: Output as plain text, JSON, or MIDI
- **Configurable Parameters**: Set tempo, key, and sensitivity
- **Progress Tracking**: Visual progress for each file

## Installation

```bash
# Clone the repository
git clone https://github.com/yksanjo/strudel-batch-cli.git
cd strudel-batch-cli

# Install dependencies
npm install

# Build
npm run build
```

## Usage

```bash
# Basic usage
strudel-batch audio1.mp3 audio2.wav audio3.ogg

# With custom output directory
strudel-batch -o ./my-output audio1.mp3 audio2.wav

# Specify tempo
strudel-batch -t 140 audio.mp3

# Specify key
strudel-batch -k Am audio.mp3

# Output as JSON
strudel-batch -f json audio.mp3
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./output` |
| `-f, --format <format>` | Output format (txt, json, midi) | `txt` |
| `-t, --tempo <bpm>` | Target tempo (overrides auto-detection) | `120` |
| `-k, --key <key>` | Target key (overrides auto-detection) | `C` |
| `-s, --sensitivity <0-100>` | Pitch detection sensitivity | `50` |

## Example

```bash
strudel-batch -o ./strudel-patterns -t 120 -k C song1.mp3 song2.mp3 song3.mp3
```

Output:
```
🎵 Strudel Batch CLI

Output directory: ./strudel-patterns
Format: txt
Tempo: 120 BPM
Key: C

Processing: song1.mp3
✓ song1.mp3
  Key: C | Tempo: 120 BPM | Notes: 24
  Saved to: ./strudel-patterns/song1.strudel.txt

Processing: song2.mp3
✓ song2.mp3
  Key: G | Tempo: 130 BPM | Notes: 18
  Saved to: ./strudel-patterns/song2.strudel.txt

Processing: song3.mp3
✓ song3.mp3
  Key: Dm | Tempo: 90 BPM | Notes: 32
  Saved to: ./strudel-patterns/song3.strudel.txt

📊 Summary
  Processed: 3
  Output: ./strudel-patterns
```

## Output Format

The CLI generates Strudel code like:

```
// Tempo: 120 BPM, Time Signature: 4/4
stack(
  note("c4 e4 g4 c4").sound("piano"),
  note("[c3,e3,g3] [a3,c4,e4]").sound("piano")
).cpm(30)
```

## License

MIT
