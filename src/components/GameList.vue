<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, useTemplateRef } from "vue";
import { useGameListStore } from "@store/global-store";
import GameItem from "@components/GameItem.vue";

// import GameEntry from "@modules/GameEntry";

const gameListStore = useGameListStore();

const collator = new Intl.Collator("ja");

const contentHeight = ref(window.innerHeight - 48 - 16);

const updateContentHeight = () => {
  contentHeight.value = window.innerHeight - 48 - 16;
};

const scrollCoverRef = useTemplateRef("scrollCoverRef");

let hideTimeout: ReturnType<typeof setTimeout>;
function hideScrollCover() {
  scrollCoverRef.value?.classList.add("hidden");
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    scrollCoverRef.value?.classList.remove("hidden");
  }, 1500);
}

onMounted(() => {
  window.addEventListener("resize", updateContentHeight);
  // virtualScrollRef.value?.$el.addEventListener("wheel", hideScrollCover);
  // virtualScrollRef.value?.$el.addEventListener("touchmove", hideScrollCover);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContentHeight);
});

const games = computed(() => {
  let filteredGames = Object.values(gameListStore.games); // 转换为数组一次即可
  if (gameListStore.searchQuery) {
    const searchQuery = gameListStore.searchQuery.toLowerCase();
    filteredGames = filteredGames.filter(
      (game) =>
        game.gameName.toLowerCase().includes(searchQuery) ||
        game.gameNameEN.toLowerCase().includes(searchQuery) ||
        game.gameBrand.toLowerCase().includes(searchQuery) ||
        game.gameBrandEN.toLowerCase().includes(searchQuery)
    );
  }
  if (gameListStore.sort.by) {
    const sortBy = gameListStore.sort.by;
    const ascending = gameListStore.sort.ascending;

    filteredGames = filteredGames.sort((gameA, gameB) => {
      if (sortBy === "gameName" || sortBy === "gameBrand") {
        // 使用日语排序
        return ascending
          ? collator.compare(gameA[sortBy], gameB[sortBy])
          : collator.compare(gameB[sortBy], gameA[sortBy]);
      } else {
        // 其他字段使用默认排序逻辑
        if (gameA[sortBy] < gameB[sortBy]) return ascending ? -1 : 1;
        if (gameA[sortBy] > gameB[sortBy]) return ascending ? 1 : -1;
        return 0;
      }
    });
  }
  return filteredGames;
});

// const totalGames = computed(() => gameListStore.totalGames);
</script>

<template>
  <v-virtual-scroll
    v-if="!gameListStore.loading"
    :height="contentHeight"
    :items="games"
    item-height="100"
    @scroll="hideScrollCover"
  >
    <template v-slot:default="{ item, index }">
      <GameItem :game="item" :index="index" :key="item.gameName" />
    </template>
  </v-virtual-scroll>
  <div
    class="cover-bar"
    ref="scrollCoverRef"
    @mouseover="hideScrollCover"
  ></div>
</template>

<style scoped>
.scroller {
  height: 100%;
}
.v-virtual-scroll {
  padding-top: 18px;
  padding-right: calc(1em - 10px);
  /* position: relative; */
}

.v-virtual-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-track {
  /* background: transparent; */
  background: #f0f0f0;
}
.v-virtual-scroll::-webkit-scrollbar-track:hover {
  background: #f0f0f0;
}

.v-virtual-scroll::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #888888;
}

.cover-bar {
  position: absolute;
  background: #fff;
  /* pointer-events: none; */
  height: 100%;
  top: 0;
  right: 0;
  width: 10px;
  transition: all 0.5s;
  opacity: 1;
}

/* .cover-bar:hover {
  opacity: 0;
} */
.cover-bar.hidden {
  pointer-events: none;
  opacity: 0;
}
</style>
