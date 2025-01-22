import { ref, reactive } from "vue";
import { defineStore } from "pinia";

export const useGameStore = defineStore("gameList", () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive<Record<string, typeof GameEntry>>({})
  const loading = ref<boolean>(false);
  const searchQuery = ref<string>("");
  const sort = reactive({ by: "gameName", ascending: true });
  const filter = reactive({
    linked: { toggled: false, value: true },
    inDatabase: { toggled: false, value: 1 },
    inAssets: { toggled: false, value: 1 },
    starred: { toggled: false, value: true },

    inNetDisk: { toggled: false, value: true },
    inSDCard: { toggled: false, value: true },
    inDeck: { toggled: false, value: true },
    inUSB: { toggled: false, value: true },
  });

  const filterOperator = ref<boolean>(true)

  // const totalDiskUsage = computed(() => {
  //   return Object.values(games).reduce((sum, game) => sum + game.diskUsage, 0);
  // });

  const config = ref({} as any);

  const steamDB = ref<typeof SteamDB | null>(null);

  return {
    games,
    loading,
    // totalDiskUsage,
    searchQuery,
    sort,
    filter,
    filterOperator,
    config,
    steamDB,
  };
});
