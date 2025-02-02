<script setup lang="ts">
  import { ref } from "vue";
  import GameEntry from "@/modules/GameEntry";

  defineProps<{ game: GameEntry }>(); // use props.game to access the game object
  const overlay = ref(false);
  const page = ref(0);

  function toggleOverlay() {
    overlay.value = !overlay.value;
  }
</script>

<template>
  <!-- 左侧图片 -->
  <v-col class="flex-grow-0 pa-0">
    <div class="game-image">
      <img
        v-if="game.imageAssets.headerSDPath"
        :src="`file://${game.imageAssets.headerSDPath}`"
        @click="toggleOverlay"
      />
      <div v-else class="game-image-placeholder"></div>
    </div>
  </v-col>
  <v-overlay
    v-model="overlay"
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
    @click="toggleOverlay"
  >
    <v-container width="85vw" max-height="100vh">
      <v-carousel v-model="page" :show-arrows="false" hide-delimiters>
        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.capsulePath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.headerPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.heroPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.logoPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.iconPath}`"
        ></v-carousel-item>
      </v-carousel>
      <br />
      <div class="d-flex justify-space-evenly align-center">
        <v-btn
          icon="$mdiChevronLeft"
          @click.stop="page = (page + 5 - 1) % 5"
        ></v-btn>
        <!-- <div class="text-h5" style="color: white">{{ page }}</div> -->
        <v-btn
          icon="$mdiChevronRight"
          @click.stop="page = (page + 1) % 5"
        ></v-btn>
      </div>
    </v-container>
  </v-overlay>
</template>

<style scoped>
  .game-image {
    height: 100px;
    border-radius: 5px;
    margin-right: 10px;
    aspect-ratio: 92 / 43;
  }

  .game-image img {
    height: 100px;
    object-fit: cover;
    border-radius: 5px;
    margin-right: 10px;
    aspect-ratio: 92 / 43;
    cursor: pointer;
  }

  .game-image-placeholder {
    height: 100px;
    border-radius: 5px;
    background-color: #f0f0f0;
    margin-right: 10px;
    aspect-ratio: 92 / 43;
  }
</style>
