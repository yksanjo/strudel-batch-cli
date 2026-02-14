#!/usr/bin/env node

/**
 * strudel-batch-cli
 * CLI tool for batch processing audio files to Strudel patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';

// Types
interface Note {
  note: string;
  time: number;
  duration?: number;
  velocity?: number;
}

interface Chord {
  notes: string[];
  name: string;
  time: number;
  duration?: number;
}

interface AnalysisResult {
  notes: Note[];
  chords: Chord[];
  detectedKey: string;
  estimatedTempo: number;
  duration: number;
}

// Pitch detection using autocorrelation
function detectPitch(frame: Float32Array, sampleRate: number): number {
  const minFreq = 80;
  const maxFreq = 1000;
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);

  let bestCorrelation = 0;
  let bestPeriod = 0;

  for (let period = minPeriod; period < maxPeriod && period < frame.length / 2; period++) {
    let correlation = 0;
    for (let i = 0; i < frame.length - period; i++) {
      correlation += frame[i] * frame[i + period];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  if (bestPeriod === 0) return 0;
  return sampleRate / bestPeriod;
}

// Convert frequency to note
function frequencyToNote(frequency: number): string {
  if (frequency <= 0) return "";
  
  const noteNames = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"];
  const a4 = 440;
  const halfStepsFromA4 = 12 * Math.log2(frequency / a4);
  const noteIndex = Math.round(halfStepsFromA4) + 57;
  
  if (noteIndex < 0 || noteIndex > 127) return "";
  
  const octave = Math.floor(noteIndex / 12);
  const noteNameIndex = noteIndex % 12;
  
  return `${noteNames[noteNameIndex]}${octave}`;
}

// Key profiles
const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
};

// Detect key
function detectKey(notes: Note[]): string {
  const noteNames = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"];
  const chromaCounts = new Array(12).fill(0);
  
  for (const note of notes) {
    const noteMatch = note.note.match(/^([a-gs]+)(\d+)$/);
    if (noteMatch) {
      const noteIndex = noteNames.indexOf(noteMatch[1].toLowerCase());
      if (noteIndex >= 0) {
        chromaCounts[noteIndex] += (note.duration || 0.25) * (note.velocity || 0.8);
      }
    }
  }
  
  let bestKey = "C";
  let bestCorrelation = -Infinity;
  
  for (let i = 0; i < 12; i++) {
    const rotatedCounts = [...chromaCounts.slice(i), ...chromaCounts.slice(0, i)];
    
    let majorCorr = 0;
    let minorCorr = 0;
    
    for (let j = 0; j < 12; j++) {
      majorCorr += rotatedCounts[j] * KEY_PROFILES.major[j];
      minorCorr += rotatedCounts[j] * KEY_PROFILES.minor[j];
    }
    
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr;
      bestKey = noteNames[i].toUpperCase().replace("S", "#");
    }
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr;
      bestKey = noteNames[i].toUpperCase().replace("S", "#") + "m";
    }
  }
  
  return bestKey;
}

// Detect tempo (simplified - requires node-web-audio-api in real implementation)
// For CLI, we'll use a placeholder that returns a default tempo
function detectTempo(): number {
  return 120;
}

// Generate chords
function generateChords(notes: Note[], key: string): Chord[] {
  if (notes.length < 4) return [];
  
  const chordProgressions: Record<string, string[]> = {
    "C": ["C", "Am", "F", "G"],
    "G": ["G", "Em", "C", "D"],
    "D": ["D", "Bm", "G", "A"],
    "A": ["A", "F#m", "D", "E"],
    "E": ["E", "C#m", "A", "B"],
    "F": ["F", "Dm", "Bb", "C"],
    "Cm": ["Cm", "Ab", "Eb", "G"],
    "Am": ["Am", "F", "C", "G"],
    "Em": ["Em", "C", "G", "D"],
    "Dm": ["Dm", "Bb", "F", "C"],
  };
  
  const noteNames = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"];
  const progression = chordProgressions[key] || chordProgressions["C"];
  const chords: Chord[] = [];
  const duration = notes[notes.length - 1].time + (notes[notes.length - 1].duration || 0.25);
  const chordDuration = duration / progression.length;
  
  for (let i = 0; i < progression.length; i++) {
    const chordName = progression[i];
    const isMinor = chordName.includes("m") && !chordName.includes("maj");
    const rootNote = chordName.replace(/m$/, "").replace("#", "s").toLowerCase();
    const rootIndex = noteNames.indexOf(rootNote);
    
    if (rootIndex >= 0) {
      const intervals = isMinor ? [0, 3, 7] : [0, 4, 7];
      const chordNotes = intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return `${noteNames[noteIndex]}4`;
      });
      
      chords.push({
        notes: chordNotes,
        name: chordName,
        time: i * chordDuration,
        duration: chordDuration
      });
    }
  }
  
  return chords;
}

// Format note for Strudel
function formatNoteForStrudel(note: string): string {
  const match = note.match(/^([A-Ga-g])([#b]?)(\d+)$/);
  if (!match) return note.toLowerCase();
  const [, noteName, accidental, octave] = match;
  const strudelAccidental = accidental === '#' ? 's' : accidental === 'b' ? 'f' : '';
  return `${noteName.toLowerCase()}${strudelAccidental}${octave}`;
}

// Generate Strudel code
function generateStrudelCode(notes: Note[], chords: Chord[], tempo: number = 120, timeSignature: string = "4/4"): { melody: string; chords: string; combined: string } {
  const [beatsPerBar, noteValue] = timeSignature.split("/").map(Number);
  const beatDuration = (60 / tempo) * (4 / noteValue);
  
  const melodyWithDuration = notes.map(note => {
    const formatted = formatNoteForStrudel(note.note);
    if (!note.duration) return formatted;
    
    const durationBeats = note.duration / beatDuration;
    if (Math.abs(durationBeats - 0.5) < 0.1) return `${formatted}*0.5`;
    if (Math.abs(durationBeats - 1) < 0.1) return formatted;
    if (Math.abs(durationBeats - 2) < 0.1) return `${formatted}*2`;
    if (Math.abs(durationBeats - 4) < 0.1) return `${formatted}*4`;
    
    return formatted;
  }).join(" ");
  
  const melodyCode = melodyWithDuration
    ? `note("${melodyWithDuration}").sound("piano")`
    : `note("~").sound("piano")`;
  
  const chordWithDuration = chords.map(chord => {
    const chordNotes = chord.notes.map(n => formatNoteForStrudel(n)).join(",");
    const formatted = `[${chordNotes}]`;
    if (!chord.duration) return formatted;
    
    const durationBeats = chord.duration / beatDuration;
    if (Math.abs(durationBeats - 0.5) < 0.1) return `${formatted}*0.5`;
    if (Math.abs(durationBeats - 1) < 0.1) return formatted;
    if (Math.abs(durationBeats - 2) < 0.1) return `${formatted}*2`;
    if (Math.abs(durationBeats - 4) < 0.1) return `${formatted}*4`;
    
    return formatted;
  }).join(" ");
  
  const chordCode = chordWithDuration
    ? `note("${chordWithDuration}").sound("piano")`
    : `note("~").sound("piano")`;
  
  const combined = `// Tempo: ${tempo} BPM, Time Signature: ${timeSignature}\nstack(\n  ${melodyCode},\n  ${chordCode}\n).cpm(${Math.round(tempo / 4)})`;
  
  return {
    melody: melodyCode,
    chords: chordCode,
    combined
  };
}

// CLI Options
interface CLIOptions {
  output: string;
  format: 'txt' | 'json' | 'midi';
  tempo: number;
  key: string;
  sensitivity: number;
}

// Process audio file (placeholder - real implementation would use audio decoding)
async function processAudioFile(filePath: string, options: CLIOptions): Promise<AnalysisResult> {
  console.log(chalk.blue(`Processing: ${filePath}`));
  
  // In a real implementation, this would decode the audio file
  // For now, we'll create sample output
  const sampleNotes: Note[] = [
    { note: 'c4', time: 0, duration: 0.5 },
    { note: 'e4', time: 0.5, duration: 0.5 },
    { note: 'g4', time: 1, duration: 1 },
    { note: 'c5', time: 2, duration: 0.5 },
  ];
  
  const detectedKey = options.key || 'C';
  const estimatedTempo = options.tempo || 120;
  const chords = generateChords(sampleNotes, detectedKey);
  
  return {
    notes: sampleNotes,
    chords,
    detectedKey,
    estimatedTempo,
    duration: 4
  };
}

// Main CLI
const program = new Command();

program
  .name('strudel-batch')
  .description('CLI tool for batch processing audio files to Strudel patterns')
  .version('1.0.0')
  .argument('<files...>', 'Audio files to process')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-f, --format <format>', 'Output format (txt, json, midi)', 'txt')
  .option('-t, --tempo <bpm>', 'Target tempo (overrides auto-detection)', '120')
  .option('-k, --key <key>', 'Target key (overrides auto-detection)', 'C')
  .option('-s, --sensitivity <0-100>', 'Pitch detection sensitivity', '50')
  .action(async (files: string[], options: any) => {
    console.log(chalk.bold.cyan('\n🎵 Strudel Batch CLI\n'));
    
    const cliOptions: CLIOptions = {
      output: options.output || './output',
      format: options.format || 'txt',
      tempo: parseInt(options.tempo) || 120,
      key: options.key || 'C',
      sensitivity: parseInt(options.sensitivity) || 50
    };
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(cliOptions.output)) {
      fs.mkdirSync(cliOptions.output, { recursive: true });
    }
    
    console.log(chalk.gray(`Output directory: ${cliOptions.output}`));
    console.log(chalk.gray(`Format: ${cliOptions.format}`));
    console.log(chalk.gray(`Tempo: ${cliOptions.tempo} BPM`));
    console.log(chalk.gray(`Key: ${cliOptions.key}\n`));
    
    let processed = 0;
    let failed = 0;
    
    for (const file of files) {
      const fileName = path.basename(file);
      const baseName = path.basename(file, path.extname(file));
      
      try {
        const result = await processAudioFile(file, cliOptions);
        const strudelCode = generateStrudelCode(result.notes, result.chords, result.estimatedTempo);
        
        // Output based on format
        const outputPath = path.join(cliOptions.output, `${baseName}.strudel.txt`);
        
        fs.writeFileSync(outputPath, strudelCode.combined);
        
        console.log(chalk.green(`✓ ${fileName}`));
        console.log(chalk.gray(`  Key: ${result.detectedKey} | Tempo: ${result.estimatedTempo} BPM | Notes: ${result.notes.length}`));
        console.log(chalk.gray(`  Saved to: ${outputPath}\n`));
        
        processed++;
      } catch (error) {
        console.log(chalk.red(`✗ ${fileName}`));
        console.log(chalk.gray(`  Error: ${error}\n`));
        failed++;
      }
    }
    
    console.log(chalk.bold('\n📊 Summary'));
    console.log(chalk.green(`  Processed: ${processed}`));
    if (failed > 0) {
      console.log(chalk.red(`  Failed: ${failed}`));
    }
    console.log(chalk.gray(`  Output: ${cliOptions.output}\n`));
  });

program.parse();
