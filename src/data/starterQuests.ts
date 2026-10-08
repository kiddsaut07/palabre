import { StarterQuest } from '../types';

export const STARTER_QUESTS: StarterQuest[] = [
  {
    id: 'quest-01',
    missionNumber: 1,
    missionText: "Find an older person in your neighborhood.\n\nAsk:\nWhat proverb did your parents repeat when you were a child?",
    theme: "wisdom",
    targetContext: "Yaoundé, Cameroon & World Neighborhoods",
  },
  {
    id: 'quest-02',
    missionNumber: 1,
    missionText: "Find someone who has lived in your neighborhood for more than 20 years.\n\nAsk:\nWhat changed the most since you arrived?",
    theme: "memory",
    targetContext: "Community Memory",
  },
  {
    id: 'quest-03',
    missionNumber: 1,
    missionText: "Find someone who learned a practical skill from an older relative.\n\nAsk:\nWho taught you, and what did they teach you that school never did?",
    theme: "craft",
    targetContext: "Living Craft",
  },
  {
    id: 'quest-04',
    missionNumber: 1,
    missionText: "Find someone who speaks a language you do not speak.\n\nAsk:\nHow do you express courage in your language?",
    theme: "language",
    targetContext: "Oral Languages & Courage",
  },
  {
    id: 'quest-05',
    missionNumber: 1,
    missionText: "Find someone who knows how to prepare a traditional meal.\n\nAsk:\nWho taught you, and what part of the recipe matters most?",
    theme: "food",
    targetContext: "Culinary Heritage",
  },
  {
    id: 'quest-06',
    missionNumber: 1,
    missionText: "Find someone who has experienced a major change in their life.\n\nAsk:\nWhat lesson from that experience do you still carry?",
    theme: "patience",
    targetContext: "Life Experience",
  },
  {
    id: 'quest-07',
    missionNumber: 1,
    missionText: "Find someone older than you.\n\nAsk:\nWhat do you think young people today misunderstand about life?",
    theme: "generational_change",
    targetContext: "Generational Dialogue",
  },
  {
    id: 'quest-08',
    missionNumber: 1,
    missionText: "Find someone who has lived in the same community for many years.\n\nAsk:\nWhat story about this place should never be forgotten?",
    theme: "community",
    targetContext: "Neighborhood Lore",
  },
  {
    id: 'quest-09',
    missionNumber: 1,
    missionText: "Find someone who works with their hands.\n\nAsk:\nWhat is something your hands learned before your mind understood it?",
    theme: "craft",
    targetContext: "Manual Intuition",
  },
  {
    id: 'quest-10',
    missionNumber: 1,
    missionText: "Find someone who had to leave home at some point.\n\nAsk:\nWhat part of home did you miss the most?",
    theme: "identity",
    targetContext: "Origins & Home",
  },
];

export function getRandomStarterQuest(): StarterQuest {
  const index = Math.floor(Math.random() * STARTER_QUESTS.length);
  return STARTER_QUESTS[index];
}
