import fs from 'fs';
import path from 'path';
import { Story } from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed stories to reflect real community baseline
const INITIAL_STORIES: Story[] = [
  {
    id: 'story-yaounde-01',
    sessionId: 'session-archived-01',
    missionNumber: 1,
    missionText: "Find an older person in your neighborhood.\n\nAsk:\nWhat proverb did your parents repeat when you were a child?",
    audioDurationSec: 42,
    audioMimeType: 'audio/webm',
    transcript: "Mon père me disait chaque matin avant le marché : 'La force du baobab ne vient pas de ses feuilles au vent, elle vient des racines qui boivent en silence.' Quand on est jeune, on veut faire du bruit, mais ce qui nourrit, c'est ce qu'on fait en silence.",
    theme: "patience",
    extracted: "« La force du baobab ne vient pas de ses feuilles, mais des racines qui boivent en silence. »",
    summary: "A merchant in Mokolo shared an ancestral proverb about inner discipline and resisting superficial noise.",
    culturalSignificance: "Preserves an oral maxim common in central Cameroonian communities connecting forestry symbolism to personal integrity.",
    nextMission: "Find someone who has built something over many years. Ask them what patience taught them that speed never could.",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'story-yaounde-02',
    sessionId: 'session-archived-02',
    missionNumber: 2,
    missionText: "Find someone who has lived in your neighborhood for more than 20 years.\n\nAsk:\nWhat changed the most since you arrived?",
    audioDurationSec: 55,
    audioMimeType: 'audio/webm',
    transcript: "I arrived here in Biyem-Assi in 1998. At that time, in the evening, all the children sat in front of the veranda listening to stories. Now everybody looks at the small screen in their palms. But when electricity cuts out, we remember each other's faces again.",
    theme: "community",
    extracted: "The evening veranda circle as the living school of neighborhood solidarity.",
    summary: "A retired teacher described the shift from physical porch storytelling to digital screens, and how neighborhood solidarity resurfaces in shared moments.",
    culturalSignificance: "Documents the transformation of public social spaces in Cameroonian cities over the turn of the millennium.",
    nextMission: "Find a craftsman or seamstress in the neighborhood. Ask them what their hands learned that school could never teach.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

class StoryStorage {
  private stories: Story[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORIES_FILE)) {
        const raw = fs.readFileSync(STORIES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.stories = parsed;
          return;
        }
      }
      // If empty or missing, seed
      this.stories = [...INITIAL_STORIES];
      this.save();
    } catch (err) {
      console.warn('Failed to read stories file, initializing with defaults:', err);
      this.stories = [...INITIAL_STORIES];
    }
  }

  private save() {
    try {
      fs.writeFileSync(STORIES_FILE, JSON.stringify(this.stories, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist stories to disk:', err);
    }
  }

  public getAll(): Story[] {
    return [...this.stories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getBySession(sessionId: string): Story[] {
    return this.stories.filter((s) => s.sessionId === sessionId);
  }

  public add(story: Story): void {
    this.stories.unshift(story);
    this.save();
  }

  public count(): number {
    return this.stories.length;
  }
}

export const storyStorage = new StoryStorage();
