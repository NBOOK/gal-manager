<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, useTemplateRef } from "vue";
import { useGameStore } from "@/store/global-store";
import GameItem from "@/components/GameItem.vue";

const gameStore = useGameStore();

const contentHeight = ref(window.innerHeight - 48 - 18);

const updateContentHeight = () => {
  contentHeight.value = window.innerHeight - 48 - 18;
};

const scrollCoverRef = useTemplateRef("scrollCoverRef");

let hideTimeout: ReturnType<typeof setTimeout>;
function tmpHideScrollCover() {
  hideScrollCover();
  showScrollCover();
}

function hideScrollCover() {
  scrollCoverRef.value?.classList.add("hidden");
  clearTimeout(hideTimeout);
}

function showScrollCover() {
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

const games = computed(() => gameStore.filterSortedGames);
</script>

<template>
  <v-virtual-scroll
    v-if="!gameStore.loading"
    :height="contentHeight"
    :items="games"
    item-height="100"
    @scroll="tmpHideScrollCover"
  >
    <template v-slot:default="{ item, index }">
      <GameItem :game="item" :index="index" :key="item.gameName" />
    </template>
  </v-virtual-scroll>
  <div
    class="cover-mask"
    ref="scrollCoverRef"
    @mouseover="tmpHideScrollCover"
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
  overflow-y: scroll;
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

.cover-mask {
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

.cover-mask.hidden {
  pointer-events: none;
  opacity: 0;
}
</style>
