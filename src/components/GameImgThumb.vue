<script setup lang="ts">
import { ref } from "vue";
import GameEntry from "@/modules/GameEntry";

defineProps<{ game: GameEntry }>(); // use props.game to access the game object
const page = ref(0);
</script>

<template>
  <v-overlay
    activator="parent"
    close-on-content-click
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
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

      <v-slide-group
        v-model="page"
        class="nav-thumbnail mt-3"
        center-active
        show-arrows
        mandatory
        @click.stop="() => {}"
        selected-class="nav-item-selected"
      >
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.capsuleSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.headerSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.heroSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.logoPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.iconPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
      </v-slide-group>
    </v-container>
  </v-overlay>
</template>

<style scoped>
.nav-thumbnail :deep(.v-slide-group__content) {
  justify-content: center !important;
}

.nav-item {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  max-height: 50px;
  margin: 0 5px 15px 5px;
  opacity: 0.5;
}

.nav-item-selected {
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 5px 8px 0 rgba(0, 0, 0, 0.14),
    0 1px 14px 0 rgba(0, 0, 0, 0.12) !important;
  opacity: 1;
}
</style>
