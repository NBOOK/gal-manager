import { ref, computed, reactive } from "vue";
import { defineStore } from "pinia";
import GameEntry from "@/modules/GameEntry";
import SteamDB from "@/modules/SteamDB";
import LutrisDB from "@/modules/LutrisDB";
import utils from "@/modules/utils";
import { DirSyncer } from "@/modules/Synchronizer";

export const useGameStore = defineStore("globalStore", () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive({} as Record<string, GameEntry>);
  const loading = ref<boolean>(false);
  const settingsOpen = ref<boolean>(false);
  const searchQuery = ref<string>("");
  const sort = reactive({ by: "gameName" as keyof GameEntry, ascending: true });
  const filter = reactive({
    linked: { toggled: false, value: true },
    inDatabase: { toggled: false, value: 1 },
    inAssets: { toggled: false, value: 1 },
    selected: { toggled: false, value: true },

    inNetDisk: { toggled: false, value: true },
    inSDCard: { toggled: false, value: true },
    inDeck: { toggled: false, value: true },

    wineRunner: { toggled: false, value: "" },
    winePrefix: { toggled: false, value: "" },
  });

  // const filterOperator = reactive({ group1: true, group2: true });
  const filterOperator = ref(true);

  const totalGames = computed(() => Object.keys(games).length);
  const filterSortedGames = computed(() =>
    utils.filterSortGames(
      Object.values(games),
      searchQuery.value,
      filter,
      filterOperator.value,
      sort.by,
      sort.ascending
    )
  );
  const selectedGames = computed(
    () => filterSortedGames.value.filter((game) => game.selected)
    // Object.values(games).filter((game) => game.selected)
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

  const downloadList = ref(
    [] as {
      game: GameEntry;
      source: string;
      target: string;
      progress: number;
    }[]
  );

  const gamesToSync = ref([] as GameEntry[]);

  const syncManager = reactive({
    syncList: [] as DirSyncer[],
    managerOpen: false,
    progress: 0,
  });

  const dataSyncManager: SyncManager = reactive({
    syncList: [] as DirSyncer[],
    managerOpen: false,
    progress: 0,
  });

  const fileOperatable = computed(() => {
    return (
      gamesToSync.value.length == 0 &&
      syncManager.syncList.length == 0 &&
      dbEditList.value.length == 0 &&
      downloadList.value.length == 0 &&
      loading.value == false
    );
  });

  const netDiskOnline = ref(false);

  const needDiskUsageRefresh = ref(false);

  return {
    games,
    loading,
    settingsOpen,
    totalGames,
    filterSortedGames,
    selectedGames,
    totalDiskUsage,
    selectedDiskUsage,
    searchQuery,
    sort,
    filter,
    filterOperator,
    config,
    steamDB,
    lutrisDB,
    netDiskOnline,
    dbEditList,
    downloadList,
    gamesToSync,
    syncManager,
    dataSyncManager,
    fileOperatable,
    needDiskUsageRefresh,
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
