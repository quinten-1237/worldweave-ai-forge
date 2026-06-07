import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Heart, Star } from "lucide-react";
import type { Story } from "@/types/story";
import { useStoryStore } from "@/store/storyStore";

export function StoryCard({ story }: { story: Story }) {
  const toggleFavorite = useStoryStore((s) => s.toggleFavorite);
  const wordCount = story.chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link
        to="/story/$id"
        params={{ id: story.id }}
        className="block bg-card border border-border rounded-xl overflow-hidden shadow-card hover:border-gold/50 hover:shadow-gold transition-all group relative"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(story.id);
          }}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/70 backdrop-blur hover:bg-background"
          aria-label="Favoriet"
        >
          <Heart
            className={`h-4 w-4 ${story.favorite ? "fill-gold text-gold" : "text-muted-foreground"}`}
          />
        </button>
        <div className="h-28 gradient-gold opacity-80 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          <BookOpen className="absolute bottom-3 left-4 h-6 w-6 text-primary-foreground/70" />
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors line-clamp-1">
            {story.title}
          </h3>
          {story.subtitle && (
            <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">
              {story.subtitle}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {story.description || "Geen beschrijving"}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span>{story.chapters.length} hfst</span>
            <span>•</span>
            <span>{wordCount.toLocaleString()} woorden</span>
            {story.genres[0] && (
              <>
                <span>•</span>
                <span className="text-gold/80 flex items-center gap-1">
                  <Star className="h-3 w-3" /> {story.genres[0]}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
