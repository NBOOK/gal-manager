<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import DBAdder from "@/components/DBAdder.vue";

const gameStore = useGameStore();
const processed = ref(0);
const page = computed(() => processed.value % 3);
const page0Game = ref<GameEntry | null>(null);
const page1Game = ref<GameEntry | null>(null);
const page2Game = ref<GameEntry | null>(null);
const overlay = ref(false);

const style = document.createElement("style"); // hack progress bar
style.innerHTML = `
  #dbAdderCarousel > * > .v-progress-linear__determinate {
    width: 0% !important;
  }`;
document.head.appendChild(style);

function setPageGame(direction: "forward" | "backward" = "forward") {
  if (direction === "forward") {
    if (processed.value + 1 < gameStore.dbEditList.length) {
      switch (page.value) {
        case 0:
          page1Game.value = gameStore.dbEditList[processed.value + 1];
          break;
        case 1:
          page2Game.value = gameStore.dbEditList[processed.value + 1];
          break;
        case 2:
          page0Game.value = gameStore.dbEditList[processed.value + 1];
          break;
      }
    }
  }
  if (direction === "backward") {
    if (processed.value - 1 >= 0) {
      switch (page.value) {
        case 0:
          page2Game.value = gameStore.dbEditList[processed.value - 1];
          break;
        case 1:
          page0Game.value = gameStore.dbEditList[processed.value - 1];
          break;
        case 2:
          page1Game.value = gameStore.dbEditList[processed.value - 1];
          break;
      }
    }
  }
}

function proceed() {
  if (processed.value + 1 === gameStore.dbEditList.length) {
    abort();
  } else {
    processed.value++;
    setPageGame("forward");
    const newWidth =
      ((processed.value + 1) / gameStore.dbEditList.length) * 100;
    style.innerHTML = `
        #dbAdderCarousel>*>.v-progress-linear__determinate {
          width: ${newWidth}% !important;
        }`;
  }
}

function goBack() {
  if (processed.value === 0) {
    abort();
  } else {
    processed.value--;
    setPageGame("backward");
    const newWidth =
      ((processed.value + 1) / gameStore.dbEditList.length) * 100;
    style.innerHTML = `
        #dbAdderCarousel>*>.v-progress-linear__determinate {
          width: ${newWidth}% !important;
        }`;
  }
}

function abort() {
  overlay.value = false;
  gameStore.dbEditList = [];
  processed.value = 0;
  page0Game.value = null;
  page1Game.value = null;
  page2Game.value = null;
}

watch(
  () => gameStore.dbEditList.length > 0,
  (newValue) => {
    if (newValue) {
      processed.value = 0;
      page0Game.value = gameStore.dbEditList[0];
      setPageGame("forward");
      overlay.value = true;

      const newWidth =
        ((processed.value + 1) / gameStore.dbEditList.length) * 100;
      style.innerHTML = `
        #dbAdderCarousel>*>.v-progress-linear__determinate {
          width: ${newWidth}% !important;
        }`;
    }
  }
);
</script>

<template>
  <v-overlay
    v-model="overlay"
    persistent
    no-click-animation
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="100vw" max-height="100%">
      <v-carousel
        id="dbAdderCarousel"
        v-model="page"
        :show-arrows="false"
        hide-delimiters
        progress="green"
        height="95vh"
      >
        <DBAdder
          v-if="page0Game !== null"
          :game="page0Game"
          key="page0"
          @goBack="goBack"
          @proceed="proceed"
          @abort="abort"
        />
        <DBAdder
          v-if="page1Game !== null"
          :game="page1Game"
          key="page1"
          @goBack="goBack"
          @proceed="proceed"
          @abort="abort"
        />
        <DBAdder
          v-if="page2Game !== null"
          :game="page2Game"
          key="page2"
          @goBack="goBack"
          @proceed="proceed"
          @abort="abort"
        />
      </v-carousel>
    </v-container>
  </v-overlay>
</template>

<style scoped></style>
