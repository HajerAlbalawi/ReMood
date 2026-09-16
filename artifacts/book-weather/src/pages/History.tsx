import { useListRecommendations, getListRecommendationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WeatherBackground } from "@/components/weather/WeatherBackground";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { BookOpen, MapPin, Cloud, Quote, Calendar } from "lucide-react";

export default function History() {
  const { data: recommendations, isLoading, isError } = useListRecommendations(
    { limit: 20 },
    { query: { queryKey: getListRecommendationsQueryKey({ limit: 20 }) } }
  );

  return (
    <AppLayout>
      <WeatherBackground conditionGroup="Atmosphere" />
      
      <div className="relative z-10 w-full min-h-screen px-4 py-12 md:px-8 max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-500 font-serif"
          >
            سجل القراءات
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mt-2"
          >
            رحلتك مع الكتب والطقس
          </motion.p>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center text-red-400 glass-panel p-8 rounded-2xl">
            عذراً، لم نتمكن من جلب سجل القراءات.
          </div>
        ) : !recommendations || recommendations.length === 0 ? (
          <div className="text-center text-muted-foreground glass-panel p-12 rounded-2xl flex flex-col items-center gap-4">
            <BookOpen className="w-12 h-12 opacity-20" />
            <p>سجلك فارغ حتى الآن. اذهب للرئيسية لاكتشاف كتب جديدة!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {recommendations.map((rec, idx) => (
              <motion.div 
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-6 border-white/5 hover:border-primary/20 transition-colors"
              >
                {/* Meta sidebar */}
                <div className="md:w-1/3 flex flex-col gap-3 border-b md:border-b-0 md:border-l border-white/10 pb-4 md:pb-0 md:pl-6">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span dir="ltr">{format(new Date(rec.createdAt), 'yyyy/MM/dd HH:mm')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/80">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{rec.city}</span>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded-md mr-auto">
                      {rec.temperature}°C
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/80">
                    <Cloud className="w-4 h-4 text-blue-400" />
                    <span>{rec.weatherCondition}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/20">
                      {rec.mood}
                    </span>
                    <span className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded-full">
                      {rec.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="md:w-2/3 flex flex-col">
                  <div className="mb-4">
                    <Quote className="w-6 h-6 text-primary/30 mb-2" />
                    <p className="italic text-white/80 font-serif leading-relaxed">
                      "{rec.moodQuote}"
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 flex flex-col gap-3">
                    <h4 className="text-sm font-semibold text-primary">الكتب المقترحة:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {rec.books.map((book, bIdx) => (
                        <div key={bIdx} className="bg-black/20 p-3 rounded-xl border border-white/5">
                          <h5 className="font-bold text-amber-50">{book.title}</h5>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
