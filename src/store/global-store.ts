import { ref, computed, reactive } from "vue";
import { defineStore } from "pinia";
import GameEntry from "@/modules/GameEntry";
import SteamDB from "@/modules/SteamDB";
import LutrisDB from "@/modules/LutrisDB";
import utils from "@/modules/utils";

export const useGameStore = defineStore("globalStore", () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive({} as Record<string, GameEntry>);
  const loading = ref<boolean>(false);
  const searchQuery = ref<string>("");
  const sort = reactive({ by: "gameName" as keyof GameEntry, ascending: true });
  const filter = reactive({
    linked: { toggled: false, value: true },
    inDatabase: { toggled: false, value: 1 },
    inAssets: { toggled: false, value: 1 },
    starred: { toggled: false, value: true },
    selected: { toggled: false, value: true },

    inNetDisk: { toggled: false, value: true },
    inSDCard: { toggled: false, value: true },
    inDeck: { toggled: false, value: true },
    inUSB: { toggled: false, value: true },
  });

  const filterOperator = reactive({ group1: true, group2: true });

  const totalGames = computed(() => Object.keys(games).length);
  const filterSortedGames = computed(() =>
    utils.filterSortGames(
      Object.values(games),
      searchQuery.value,
      filter,
      filterOperator,
      sort.by,
      sort.ascending
    )
  );
  const selectedGames = computed(() =>
    filterSortedGames.value.filter((game) => game.selected)
  );
  const starredGames = computed(() =>
    filterSortedGames.value.filter((game) => game.starred)
  );
  const selectedDiskUsage = computed(() => {
    return selectedGames.value.reduce((sum, game) => sum + game.diskUsage, 0);
  });
  const totalDiskUsage = computed(() => {
    return Object.values(games).reduce((sum, game) => sum + game.diskUsage, 0);
  });

  const config = ref({} as any);

  const steamDB = ref<SteamDB>(new SteamDB());
  const lutrisDB = ref<LutrisDB>(new LutrisDB());

  const dbEditList = ref([] as GameEntry[]);

  return {
    games,
    loading,
    totalGames,
    filterSortedGames,
    selectedGames,
    starredGames,
    totalDiskUsage,
    selectedDiskUsage,
    searchQuery,
    sort,
    filter,
    filterOperator,
    config,
    steamDB,
    lutrisDB,
    dbEditList,
  };
});

// Extend the Window interface to include the utils property
// For debugging purposes only
declare global {
  interface Window {
    utils: typeof utils;
  }
}

window.utils = utils;
