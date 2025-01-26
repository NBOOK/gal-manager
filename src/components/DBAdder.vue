<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGameStore } from "@store/global-store";
import GameEntry from "@modules/GameEntry";

const gameStore = useGameStore();
const processed = ref(0);
const page = computed(() => processed.value % 3);
const page0Game = ref<GameEntry | null>(null);
const page1Game = ref<GameEntry | null>(null);
const page2Game = ref<GameEntry | null>(null);
const overlay = ref(false);

function setPageGame() {
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
  if (processed.value + 2 < gameStore.dbEditList.length) {
    switch (page.value) {
      case 0:
        page2Game.value = gameStore.dbEditList[processed.value + 2];
        break;
      case 1:
        page0Game.value = gameStore.dbEditList[processed.value + 2];
        break;
      case 2:
        page1Game.value = gameStore.dbEditList[processed.value + 2];
        break;
    }
  }
}

function proceed() {
  if (processed.value + 1 === gameStore.dbEditList.length) {
    overlay.value = false;
    gameStore.dbEditList = [];
    processed.value = 0;
    page0Game.value = null;
    page1Game.value = null;
    page2Game.value = null;
  } else {
    processed.value++;
    setPageGame();
  }
}

watch(
  () => gameStore.dbEditList.length > 0,
  (newValue) => {
    if (newValue) {
      processed.value = 0;
      page0Game.value = gameStore.dbEditList[0];
      setPageGame();
      overlay.value = true;
    }
  }
);
</script>

<template>
  <v-overlay
    v-model="overlay"
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="85vw" max-height="100vh">
      <v-carousel v-model="page" :show-arrows="false" hide-delimiters>
        <v-carousel-item v-if="page0Game !== null" key="page0Game">
          <v-sheet rounded="lg" elevation="3" height="50vh" min-width="550px">
            <div>{{ page0Game.gameName }}</div>
          </v-sheet>
        </v-carousel-item>

        <v-carousel-item v-if="page1Game !== null" key="page1Game">
          <v-sheet rounded="lg" elevation="3" height="50vh" min-width="550px">
            <div>{{ page1Game.gameName }}</div>
          </v-sheet>
        </v-carousel-item>

        <v-carousel-item v-if="page2Game !== null" key="page1Game">
          <v-sheet rounded="lg" elevation="3" height="50vh" min-width="550px">
            <div>{{ page2Game.gameName }}</div>
          </v-sheet>
        </v-carousel-item>
      </v-carousel>
      <br />
      <div class="d-flex justify-space-evenly align-center">
        <v-btn icon="mdi-chevron-left" @click.stop="proceed"></v-btn>
        <!-- <div class="text-h5" style="color: white">{{ page }}</div> -->
        <v-btn icon="mdi-chevron-right" @click.stop="proceed"></v-btn>
      </div>
    </v-container>
  </v-overlay>
</template>
