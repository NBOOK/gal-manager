<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@store/global-store";

const gameStore = useGameStore();
const sortConfig = gameStore.sort;
const filterConfig = gameStore.filter;

const filterLinked = computed(() => {
  const linked = filterConfig.linked;
  if (linked.toggled) {
    return {
      icon: linked.value ? "mdi-link" : "mdi-link-off",
      color: linked.value ? "green" : "red",
      action: () => {
        linked.value = !linked.value;
        linked.toggled = !linked.value;
      },
    };
  }
  return {
    icon: "mdi-link",
    color: "geay-darken-4",
    action: () => (linked.toggled = true),
  };
});

const filterDatabase = computed(() => {
  const inDatabase = filterConfig.inDatabase;
  if (inDatabase.toggled)
    return {
      icon: ["mdi-database-remove", "mdi-database-check", "mdi-database-minus"][
        inDatabase.value
      ],
      color: ["red", "green", "orange"][inDatabase.value],
      action: () => {
        inDatabase.value = (inDatabase.value + 1) % 3;
        inDatabase.toggled = inDatabase.value !== 1;
      },
    };
  return {
    icon: "mdi-database",
    color: "geay-darken-4",
    action: () => {
      inDatabase.toggled = true;
    },
  };
});

const filterImage = computed(() => {
  const inAssets = filterConfig.inAssets;
  if (inAssets.toggled)
    return {
      icon: ["mdi-image-remove", "mdi-image-check", "mdi-image-minus"][
        inAssets.value
      ],
      color: ["red", "green", "orange"][inAssets.value],
      action: () => {
        inAssets.value = (inAssets.value + 1) % 3;
        inAssets.toggled = inAssets.value !== 1;
      },
    };
  return {
    icon: "mdi-image",
    color: "geay-darken-4",
    action: () => {
      inAssets.toggled = true;
    },
  };
});

// const filterStarred = computed(() => {
//   const starred = filterConfig.starred;
//   if (starred.toggled)
//     return {
//       icon: starred.value ? "mdi-star" : "mdi-star-outline",
//       color: "amber",
//       action: () => {
//         starred.value = !starred.value;
//         starred.toggled = !starred.value;
//       },
//     };
//   return {
//     icon: "mdi-star",
//     color: "geay-darken-4",
//     action: () => {
//       starred.toggled = true;
//     },
//   };
// });

const filterSelected = computed(() => {
  const selected = filterConfig.selected;
  if (selected.toggled)
    return {
      icon: selected.value
        ? "mdi-checkbox-marked"
        : "mdi-checkbox-blank-outline",
      color: "geay-darken-4",
      action: () => {
        selected.value = !selected.value;
        selected.toggled = !selected.value;
      },
    };
  return {
    icon: "mdi-checkbox-blank-off-outline",
    color: "geay-darken-4",
    action: () => {
      selected.toggled = true;
    },
  };
});

const filterCloud = computed(() => {
  const inNetDisk = filterConfig.inNetDisk;
  if (inNetDisk.toggled)
    return {
      icon: "mdi-cloud",
      color: inNetDisk.value ? "green" : "red",
      action: () => {
        inNetDisk.value = !inNetDisk.value;
        inNetDisk.toggled = !inNetDisk.value;
      },
    };
  return {
    icon: "mdi-cloud",
    color: "geay-darken-4",
    action: () => {
      inNetDisk.toggled = true;
    },
  };
});

const filterDeck = computed(() => {
  const inDeck = filterConfig.inDeck;
  if (inDeck.toggled)
    return {
      icon: "mdi-gamepad-square",
      color: inDeck.value ? "green" : "red",
      action: () => {
        inDeck.value = !inDeck.value;
        inDeck.toggled = !inDeck.value;
      },
    };
  return {
    icon: "mdi-gamepad-square",
    color: "geay-darken-4",
    action: () => {
      inDeck.toggled = true;
    },
  };
});

const filterSD = computed(() => {
  const inSDCard = filterConfig.inSDCard;
  if (inSDCard.toggled)
    return {
      icon: "mdi-micro-sd",
      color: inSDCard.value ? "green" : "red",
      action: () => {
        inSDCard.value = !inSDCard.value;
        inSDCard.toggled = !inSDCard.value;
      },
    };
  return {
    icon: "mdi-micro-sd",
    color: "geay-darken-4",
    action: () => {
      inSDCard.toggled = true;
    },
  };
});

const filterUSB = computed(() => {
  const inUSB = filterConfig.inUSB;
  if (inUSB.toggled)
    return {
      icon: "mdi-usb",
      color: inUSB.value ? "green" : "red",
      action: () => {
        inUSB.value = !inUSB.value;
        inUSB.toggled = !inUSB.value;
      },
    };
  return {
    icon: "mdi-usb",
    color: "geay-darken-4",
    action: () => {
      inUSB.toggled = true;
    },
  };
});

function checkAllFilteredGames() {
  gameStore.filterSortedGames.forEach((game) => (game.selected = true));
}

function uncheckAllFilteredGames() {
  gameStore.filterSortedGames.forEach((game) => (game.selected = false));
}
</script>

<template>
  <v-container>
    <v-app-bar
      :elevation="3"
      rounded="lg"
      scroll-behavior="fully-hide"
      density="compact"
    >
      <template v-slot:prepend>
        <v-btn
          icon
          :loading="gameStore.loading"
          @click="gameStore.loading = true"
        >
          <v-icon
            :icon="gameStore.totalGames ? 'mdi-reload' : 'mdi-magnify-scan'"
          />
          <v-tooltip
            activator="parent"
            location="bottom"
            open-delay="500"
            close-on-content-click
          >
            {{ gameStore.totalGames ? "Rescan games" : "Scan games" }}
          </v-tooltip>
        </v-btn>
        <v-spacer></v-spacer>
      </template>

      <!-- Search box -->
      <v-text-field
        id="searchbox-no-border"
        variant="outlined"
        hide-details
        clearable
        clear-icon="mdi-backspace-outline"
        :placeholder="`Search ${gameStore.totalGames} games (JP/EN)`"
        prepend-inner-icon="mdi-magnify"
        single-line
        max-width="51%"
        rounded="lg"
        v-model="gameStore.searchQuery"
        @keydown.esc="gameStore.searchQuery = ''"
      ></v-text-field>

      <!-- Sort -->
      <v-btn icon>
        <v-icon icon="mdi-sort"></v-icon>
        <v-menu
          activator="parent"
          :close-on-content-click="false"
          scroll-strategy="close"
          transition="slide-y-transition"
        >
          <v-sheet rounded="lg">
            <v-btn-toggle mandatory v-model="sortConfig.ascending">
              <v-btn :value="true">
                <v-icon size="x-large">mdi-sort-ascending</v-icon>
              </v-btn>

              <v-btn :value="false">
                <v-icon size="x-large">mdi-sort-descending</v-icon>
              </v-btn>
            </v-btn-toggle>

            <v-divider></v-divider>

            <v-btn-toggle mandatory class="grid2x2" v-model="sortConfig.by">
              <v-btn value="gameName">
                <v-icon size="x-large">mdi-alphabetical-variant</v-icon>
              </v-btn>

              <v-btn value="gameBrand">
                <v-icon size="x-large">mdi-domain</v-icon>
              </v-btn>

              <v-btn value="modifiedTime">
                <v-icon size="x-large">mdi-calendar-month-outline</v-icon>
              </v-btn>

              <v-btn value="diskUsage">
                <v-icon size="x-large">mdi-chart-pie-outline</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-sheet>
        </v-menu>
      </v-btn>

      <!-- Filter -->
      <v-btn icon>
        <v-icon
          :icon="
            Object.values(filterConfig).some((filter: any) => filter.toggled)
              ? 'mdi-filter'
              : 'mdi-filter-outline'
          "
        ></v-icon>
        <v-menu
          activator="parent"
          :close-on-content-click="false"
          scroll-strategy="close"
          transition="slide-y-transition"
        >
          <v-sheet rounded="lg">
            <v-btn
              width="100%"
              variant="flat"
              density="compact"
              v-model="gameStore.filterOperator.group1"
              @click="
                gameStore.filterOperator.group1 =
                  !gameStore.filterOperator.group1
              "
            >
              {{ gameStore.filterOperator.group1 ? "AND" : "OR" }}
            </v-btn>
            <v-btn-group class="grid2x2">
              <v-btn @click="filterLinked.action">
                <v-icon
                  :icon="filterLinked.icon"
                  :color="filterLinked.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterDatabase.action">
                <v-icon
                  :icon="filterDatabase.icon"
                  :color="filterDatabase.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterImage.action">
                <v-icon
                  :icon="filterImage.icon"
                  :color="filterImage.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <!-- <v-btn @click="filterStarred.action">
                <v-icon
                  :icon="filterStarred.icon"
                  :color="filterStarred.color"
                  size="x-large"
                ></v-icon>
              </v-btn> -->

              <v-btn @click="filterSelected.action">
                <v-icon
                  :icon="filterSelected.icon"
                  :color="filterSelected.color"
                  size="x-large"
                ></v-icon>
              </v-btn>
            </v-btn-group>

            <v-divider></v-divider>

            <v-btn
              width="100%"
              variant="flat"
              density="compact"
              v-model="gameStore.filterOperator.group2"
              @click="
                gameStore.filterOperator.group2 =
                  !gameStore.filterOperator.group2
              "
            >
              {{ gameStore.filterOperator.group2 ? "AND" : "OR" }}
            </v-btn>
            <v-btn-group class="grid2x2">
              <v-btn @click="filterCloud.action">
                <v-icon
                  :icon="filterCloud.icon"
                  :color="filterCloud.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterDeck.action">
                <v-icon
                  :icon="filterDeck.icon"
                  :color="filterDeck.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterSD.action">
                <v-icon
                  :icon="filterSD.icon"
                  :color="filterSD.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterUSB.action">
                <v-icon
                  :icon="filterUSB.icon"
                  :color="filterUSB.color"
                  size="x-large"
                ></v-icon>
              </v-btn>
            </v-btn-group>
          </v-sheet>
        </v-menu>
      </v-btn>

      <template v-slot:append>
        <v-spacer></v-spacer>
        <!-- <v-btn
          :class="{ invisible: gameStore.selectedGames.length === 0 }"
          icon
          @click="gameStore.dbEditList.push(...gameStore.selectedGames)"
        >
          <v-icon icon="mdi-database-edit" />
        </v-btn> -->
        <v-btn icon>
          <v-icon icon="mdi-dots-vertical" />
          <v-menu
            activator="parent"
            :close-on-content-click="false"
            scroll-strategy="close"
            transition="slide-y-transition"
          >
            <v-sheet rounded="lg">
              <v-btn-group>
                <v-btn @click="checkAllFilteredGames">
                  <v-icon size="x-large">mdi-checkbox-multiple-marked</v-icon>
                </v-btn>

                <v-btn @click="uncheckAllFilteredGames">
                  <v-icon size="x-large"
                    >mdi-checkbox-multiple-blank-outline</v-icon
                  >
                </v-btn>
              </v-btn-group>

              <v-divider></v-divider>

              <v-btn-group class="grid2x2">
                <v-btn
                  :readonly="gameStore.selectedGames.length === 0"
                  @click="gameStore.dbEditList.push(...gameStore.selectedGames)"
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-database-edit</v-icon
                  >
                </v-btn>

                <v-btn
                  :readonly="
                    gameStore.selectedGames.length === 0 ||
                    gameStore.selectedGames.some(
                      (game) => game.inDeck || game.inSDCard || game.inUSB
                    )
                  "
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0 ||
                      gameStore.selectedGames.some(
                        (game) => game.inDeck || game.inSDCard || game.inUSB
                      )
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-cloud-download</v-icon
                  >
                </v-btn>

                <v-btn
                  :readonly="
                    gameStore.selectedGames.length === 0 ||
                    !gameStore.selectedGames.every(
                      (game) => game.inDeck || game.inSDCard || game.inUSB
                    )
                  "
                >
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0 ||
                      !gameStore.selectedGames.every(
                        (game) => game.inDeck || game.inSDCard || game.inUSB
                      )
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-delete</v-icon
                  >
                </v-btn>

                <v-btn :readonly="gameStore.selectedGames.length === 0">
                  <v-icon
                    :color="
                      gameStore.selectedGames.length === 0
                        ? 'grey'
                        : 'grey-darken-4'
                    "
                    size="x-large"
                    >mdi-chart-pie-outline</v-icon
                  >
                </v-btn>
              </v-btn-group>
            </v-sheet>
          </v-menu>
        </v-btn>
      </template>
    </v-app-bar>
  </v-container>
</template>

<style>
.grid2x2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  /* 2 列 */
  height: 96px !important;
}

.v-field__field:has(> #searchbox-no-border) ~ .v-field__outline {
  /* border: red solid; */
  visibility: hidden;
}

.invisible {
  visibility: hidden;
}
</style>
