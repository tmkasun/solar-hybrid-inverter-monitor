var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export const allCities = [
    {
        id: 1,
        provinceId: '4',
        name: 'Central',
        district: [
            {
                districtId: '7',
                name: 'Kandy',
                cities: [
                    {
                        cityId: 10,
                        name: 'Akurana',
                    },
                    {
                        cityId: 13,
                        name: 'Aladeniya',
                    },
                    {
                        cityId: 15,
                        name: 'Alawatugoda',
                    },
                    {
                        cityId: 33,
                        name: 'Ankubura',
                    },
                    {
                        cityId: 92,
                        name: 'Bokkawala',
                    },
                    {
                        cityId: 153,
                        name: 'Delpitiya',
                    },
                    {
                        cityId: 154,
                        name: 'Deltota',
                    },
                    {
                        cityId: 192,
                        name: 'Galagedara',
                    },
                    {
                        cityId: 194,
                        name: 'Galaha',
                    },
                    {
                        cityId: 209,
                        name: 'Gampola',
                    },
                    {
                        cityId: 229,
                        name: 'Gurudeniya - Gelioya',
                    },
                    {
                        cityId: 239,
                        name: 'Hasalaka',
                    },
                    {
                        cityId: 240,
                        name: 'Hataraliyadda',
                    },
                    {
                        cityId: 265,
                        name: 'Hunnasgiriya',
                    },
                    {
                        cityId: 286,
                        name: 'Kadugannawa',
                    },
                    {
                        cityId: 327,
                        name: 'Kandy',
                    },
                    {
                        cityId: 333,
                        name: 'Karaliyedde',
                    },
                    {
                        cityId: 342,
                        name: 'Katugasthota',
                    },
                    {
                        cityId: 360,
                        name: 'Kengalla',
                    },
                    {
                        cityId: 409,
                        name: 'Kundasale',
                    },
                    {
                        cityId: 423,
                        name: 'Madawala',
                    },
                    {
                        cityId: 441,
                        name: 'Mailapitiya',
                    },
                    {
                        cityId: 493,
                        name: 'Menikhinna',
                    },
                    {
                        cityId: 552,
                        name: 'Nawalapitiya',
                    },
                    {
                        cityId: 587,
                        name: 'Nugawela',
                    },
                    {
                        cityId: 622,
                        name: 'Panwila',
                    },
                    {
                        cityId: 634,
                        name: 'Peradeniya',
                    },
                    {
                        cityId: 641,
                        name: 'Pilimathalawa',
                    },
                    {
                        cityId: 668,
                        name: 'Pujapitiya',
                    },
                    {
                        cityId: 678,
                        name: 'Pussellawa',
                    },
                    {
                        cityId: 688,
                        name: 'Rajawella',
                    },
                    {
                        cityId: 703,
                        name: 'Rikillagaskada',
                    },
                    {
                        cityId: 735,
                        name: 'Talatuoya',
                    },
                    {
                        cityId: 744,
                        name: 'Teldeniya',
                    },
                    {
                        cityId: 746,
                        name: 'Tennekumbura',
                    },
                    {
                        cityId: 750,
                        name: 'Thalakiriyagama',
                    },
                    {
                        cityId: 784,
                        name: 'Udatenna - Medamaha Nuwara',
                    },
                    {
                        cityId: 786,
                        name: 'Ududumbara',
                    },
                    {
                        cityId: 837,
                        name: 'Wattegama',
                    },
                    {
                        cityId: 846,
                        name: 'Weligalla',
                    },
                    {
                        cityId: 868,
                        name: 'Werellagama',
                    },
                    {
                        cityId: 881,
                        name: 'Ambathanna',
                    },
                ],
            },
            {
                districtId: '10',
                name: 'Matale',
                cities: [
                    {
                        cityId: 143,
                        name: 'Dambulla',
                    },
                    {
                        cityId: 159,
                        name: 'Devahuwa',
                    },
                    {
                        cityId: 197,
                        name: 'Galewela',
                    },
                    {
                        cityId: 273,
                        name: 'Inamaluwa',
                    },
                    {
                        cityId: 467,
                        name: 'Matale',
                    },
                    {
                        cityId: 548,
                        name: 'Naula',
                    },
                    {
                        cityId: 558,
                        name: 'Neelagama',
                    },
                    {
                        cityId: 603,
                        name: 'Palapathwala',
                    },
                    {
                        cityId: 606,
                        name: 'Pallepola',
                    },
                    {
                        cityId: 700,
                        name: 'Rattota',
                    },
                    {
                        cityId: 793,
                        name: 'Ukuwela',
                    },
                    {
                        cityId: 870,
                        name: 'Wilgamuwa',
                    },
                    {
                        cityId: 878,
                        name: 'Yatawatta',
                    },
                ],
            },
            {
                districtId: '11',
                name: 'Nuwara Eliya',
                cities: [
                    {
                        cityId: 215,
                        name: 'Ginigathena',
                    },
                    {
                        cityId: 236,
                        name: 'Hanguranketa',
                    },
                    {
                        cityId: 241,
                        name: 'Hatton',
                    },
                    {
                        cityId: 325,
                        name: 'Kandapola',
                    },
                    {
                        cityId: 353,
                        name: 'Keertibandarapura',
                    },
                    {
                        cityId: 394,
                        name: 'Kotagala',
                    },
                    {
                        cityId: 465,
                        name: 'Maskeliya',
                    },
                    {
                        cityId: 541,
                        name: 'Nanu Oya',
                    },
                    {
                        cityId: 584,
                        name: 'Nortonbridge',
                    },
                    {
                        cityId: 585,
                        name: 'Norwood',
                    },
                    {
                        cityId: 590,
                        name: 'Nuwara Eliya',
                    },
                    {
                        cityId: 598,
                        name: 'Padiyapelella',
                    },
                    {
                        cityId: 674,
                        name: 'Pundaluoya',
                    },
                    {
                        cityId: 684,
                        name: 'Ragala',
                    },
                    {
                        cityId: 737,
                        name: 'Talawakele',
                    },
                    {
                        cityId: 743,
                        name: 'Tawalantenna',
                    },
                    {
                        cityId: 789,
                        name: 'Udupussellawa',
                    },
                    {
                        cityId: 836,
                        name: 'Wattawala',
                    },
                ],
            },
        ],
    },
    {
        id: 2,
        provinceId: '8',
        name: 'Eastern',
        district: [
            {
                districtId: '12',
                name: 'Batticaloa',
                cities: [
                    {
                        cityId: 40,
                        name: 'Arasaditivu - Kokkaddicholai',
                    },
                    {
                        cityId: 381,
                        name: 'Kokkaddichcholai',
                    },
                    {
                        cityId: 41,
                        name: 'Arayampathy',
                    },
                    {
                        cityId: 74,
                        name: 'Batticaloa',
                    },
                    {
                        cityId: 110,
                        name: 'Chenkaladi',
                    },
                    {
                        cityId: 189,
                        name: 'Eravur',
                    },
                    {
                        cityId: 302,
                        name: 'Kalawanchikudy',
                    },
                    {
                        cityId: 313,
                        name: 'Kaluwankarni',
                    },
                    {
                        cityId: 340,
                        name: 'Kattankudy',
                    },
                    {
                        cityId: 370,
                        name: 'Kirankulam',
                    },
                    {
                        cityId: 411,
                        name: 'Kurukkalmadam',
                    },
                    {
                        cityId: 442,
                        name: 'Main Street - Valachchenai',
                    },
                    {
                        cityId: 804,
                        name: 'Valachchenai - Oddamawadi',
                    },
                    {
                        cityId: 803,
                        name: 'Valachchenai',
                    },
                    {
                        cityId: 453,
                        name: 'Mandoor - Palamunai',
                    },
                    {
                        cityId: 636,
                        name: 'Periyakallar',
                    },
                    {
                        cityId: 637,
                        name: 'Periyaporathvu',
                    },
                    {
                        cityId: 701,
                        name: 'Rideetenna',
                    },
                    {
                        cityId: 752,
                        name: 'Thalankuda',
                    },
                    {
                        cityId: 759,
                        name: 'Thiavaddavan - Oddamavadi',
                    },
                    {
                        cityId: 802,
                        name: 'Vakarai',
                    },
                    {
                        cityId: 812,
                        name: 'Vellavely',
                    },
                ],
            },
            {
                districtId: '13',
                name: 'Ampara',
                cities: [
                    {
                        cityId: 1,
                        name: 'Addalachchenai',
                    },
                    {
                        cityId: 6,
                        name: 'Akkaraipattu',
                    },
                    {
                        cityId: 17,
                        name: 'Alayadivembu',
                    },
                    {
                        cityId: 28,
                        name: 'Ampara',
                    },
                    {
                        cityId: 108,
                        name: 'Chawalakadai',
                    },
                    {
                        cityId: 147,
                        name: 'Dehiatthakandiya',
                    },
                    {
                        cityId: 150,
                        name: 'Deiattakandiya',
                    },
                    {
                        cityId: 252,
                        name: 'Hingurana',
                    },
                    {
                        cityId: 276,
                        name: 'Irakkamam',
                    },
                    {
                        cityId: 303,
                        name: 'Kalmunai',
                    },
                    {
                        cityId: 305,
                        name: 'Kalmunaikudy - 14',
                    },
                    {
                        cityId: 332,
                        name: 'Karaitivu - Ep',
                    },
                    {
                        cityId: 429,
                        name: 'Maha Oya',
                    },
                    {
                        cityId: 578,
                        name: 'Nintavur',
                    },
                    {
                        cityId: 592,
                        name: 'Oluvil',
                    },
                    {
                        cityId: 599,
                        name: 'Padiyatalawa',
                    },
                    {
                        cityId: 662,
                        name: 'Pottuvil',
                    },
                    {
                        cityId: 705,
                        name: 'Sainthamaruthu',
                    },
                    {
                        cityId: 708,
                        name: 'Samanthurai',
                    },
                    {
                        cityId: 711,
                        name: 'Sandunpura',
                    },
                    {
                        cityId: 774,
                        name: 'Tirukkovil',
                    },
                    {
                        cityId: 792,
                        name: 'Uhana',
                    },
                ],
            },
            {
                districtId: '14',
                name: 'Trincomalee',
                cities: [
                    {
                        cityId: 214,
                        name: 'Gantalawa',
                    },
                    {
                        cityId: 225,
                        name: 'Gomarankadawela',
                    },
                    {
                        cityId: 330,
                        name: 'Kantale',
                    },
                    {
                        cityId: 367,
                        name: 'Kinniya',
                    },
                    {
                        cityId: 402,
                        name: 'Kuchchiveli',
                    },
                    {
                        cityId: 512,
                        name: 'Morawewa',
                    },
                    {
                        cityId: 527,
                        name: 'Mutur',
                    },
                    {
                        cityId: 573,
                        name: 'Nilaveli',
                    },
                    {
                        cityId: 574,
                        name: 'Nilaveli - Irrakkandy',
                    },
                    {
                        cityId: 671,
                        name: 'Pulmoddai',
                    },
                    {
                        cityId: 715,
                        name: 'Serunuwara',
                    },
                    {
                        cityId: 719,
                        name: 'Sinna Kinniya',
                    },
                    {
                        cityId: 722,
                        name: 'Siripura',
                    },
                    {
                        cityId: 780,
                        name: 'Trincomalee',
                    },
                ],
            },
        ],
    },
    {
        id: 3,
        provinceId: '6',
        name: 'Northern',
        district: [
            {
                districtId: '17',
                name: 'Jaffna',
                cities: [
                    {
                        cityId: 14,
                        name: 'Alaveddy',
                    },
                    {
                        cityId: 45,
                        name: 'Atchuvely',
                    },
                    {
                        cityId: 106,
                        name: 'Chankanai',
                    },
                    {
                        cityId: 107,
                        name: 'Chavakachcheri',
                    },
                    {
                        cityId: 114,
                        name: 'Chunnakam',
                    },
                    {
                        cityId: 281,
                        name: 'Jaffna',
                    },
                    {
                        cityId: 293,
                        name: 'Kaithady',
                    },
                    {
                        cityId: 331,
                        name: 'Karainagar',
                    },
                    {
                        cityId: 351,
                        name: 'Kayts',
                    },
                    {
                        cityId: 379,
                        name: 'Kodikamam',
                    },
                    {
                        cityId: 383,
                        name: 'Kokuvil',
                    },
                    {
                        cityId: 385,
                        name: 'Kopay',
                    },
                    {
                        cityId: 408,
                        name: 'Kuncharkadai',
                    },
                    {
                        cityId: 447,
                        name: 'Mallakam',
                    },
                    {
                        cityId: 454,
                        name: 'Manipay',
                    },
                    {
                        cityId: 457,
                        name: 'Manthikai',
                    },
                    {
                        cityId: 464,
                        name: 'Maruthanarmadam',
                    },
                    {
                        cityId: 471,
                        name: 'Mathagal',
                    },
                    {
                        cityId: 528,
                        name: 'Myliddy',
                    },
                    {
                        cityId: 536,
                        name: 'Nallur',
                    },
                    {
                        cityId: 566,
                        name: 'Nelliady',
                    },
                    {
                        cityId: 614,
                        name: 'Pandatharippu',
                    },
                    {
                        cityId: 672,
                        name: 'Puloly',
                    },
                    {
                        cityId: 675,
                        name: 'Punkudutivu',
                    },
                    {
                        cityId: 676,
                        name: 'Punnalaikaduvan',
                    },
                    {
                        cityId: 681,
                        name: 'Puttur',
                    },
                    {
                        cityId: 710,
                        name: 'Sandilipay',
                    },
                    {
                        cityId: 725,
                        name: 'Siruppiddy',
                    },
                    {
                        cityId: 738,
                        name: 'Talayadi',
                    },
                    {
                        cityId: 745,
                        name: 'Tellippalai',
                    },
                    {
                        cityId: 765,
                        name: 'Thirunelveli',
                    },
                    {
                        cityId: 790,
                        name: 'Uduvil',
                    },
                    {
                        cityId: 800,
                        name: 'Urumpirai',
                    },
                    {
                        cityId: 805,
                        name: 'Valvettithurai',
                    },
                    {
                        cityId: 811,
                        name: 'Velanai',
                    },
                ],
            },
            {
                districtId: '18',
                name: 'Mannar',
                cities: [
                    {
                        cityId: 456,
                        name: 'Mannar',
                    },
                    {
                        cityId: 524,
                        name: 'Murungan',
                    },
                    {
                        cityId: 539,
                        name: 'Nanattan',
                    },
                    {
                        cityId: 718,
                        name: 'Silawattura',
                    },
                    {
                        cityId: 724,
                        name: 'Siritoppu',
                    },
                    {
                        cityId: 734,
                        name: 'Thalaimannar Pier',
                    },
                    {
                        cityId: 749,
                        name: 'Thalaimannar',
                    },
                    {
                        cityId: 757,
                        name: 'Tharapuram',
                    },
                ],
            },
            {
                districtId: '19',
                name: 'Mulalativu',
                cities: [
                    {
                        cityId: 448,
                        name: 'Mallavi',
                    },
                    {
                        cityId: 772,
                        name: 'Thunnukai - Mallavi',
                    },
                    {
                        cityId: 455,
                        name: 'Mankulam',
                    },
                    {
                        cityId: 518,
                        name: 'Mulattivu',
                    },
                    {
                        cityId: 521,
                        name: 'Mulliyawalai',
                    },
                    {
                        cityId: 554,
                        name: 'Nayaru',
                    },
                    {
                        cityId: 591,
                        name: 'Oddusuddan',
                    },
                    {
                        cityId: 679,
                        name: 'Puthukudiyiruppu',
                    },
                    {
                        cityId: 818,
                        name: 'Visvamadhukulam',
                    },
                ],
            },
            {
                districtId: '20',
                name: 'Vavuniya',
                cities: [
                    {
                        cityId: 109,
                        name: 'Cheddikulam',
                    },
                    {
                        cityId: 318,
                        name: 'Kanagarayamkulam',
                    },
                    {
                        cityId: 557,
                        name: 'Nedunkarny',
                    },
                    {
                        cityId: 593,
                        name: 'Omanthai',
                    },
                    {
                        cityId: 809,
                        name: 'Vavuniya',
                    },
                ],
            },
            {
                districtId: '21',
                name: 'Killinochchi',
                cities: [
                    {
                        cityId: 9,
                        name: 'Akkarayankulam',
                    },
                    {
                        cityId: 278,
                        name: 'Iyakachchi',
                    },
                    {
                        cityId: 365,
                        name: 'Kilinochchi',
                    },
                    {
                        cityId: 517,
                        name: 'Mulankavil',
                    },
                    {
                        cityId: 604,
                        name: 'Pallai',
                    },
                    {
                        cityId: 625,
                        name: 'Paranthan',
                    },
                    {
                        cityId: 801,
                        name: 'Vadiyadi',
                    },
                ],
            },
        ],
    },
    {
        id: 4,
        provinceId: '7',
        name: 'North Central',
        district: [
            {
                districtId: '15',
                name: 'Anuradhapura',
                cities: [
                    {
                        cityId: 34,
                        name: 'Anuradhapura',
                    },
                    {
                        cityId: 91,
                        name: 'Bogaswewa - Ikirigollewa',
                    },
                    {
                        cityId: 103,
                        name: 'Bulnewa',
                    },
                    {
                        cityId: 188,
                        name: 'Eppawela',
                    },
                    {
                        cityId: 196,
                        name: 'Galenbindunuwewa',
                    },
                    {
                        cityId: 200,
                        name: 'Galkulama',
                    },
                    {
                        cityId: 206,
                        name: 'Galnewa',
                    },
                    {
                        cityId: 231,
                        name: 'Habarana',
                    },
                    {
                        cityId: 263,
                        name: 'Horowupotana',
                    },
                    {
                        cityId: 269,
                        name: 'Ihalawewa - Kiralogama',
                    },
                    {
                        cityId: 291,
                        name: 'Kahatagasdigiliya',
                    },
                    {
                        cityId: 352,
                        name: 'Kebitigollawa',
                    },
                    {
                        cityId: 356,
                        name: 'Kekirawa',
                    },
                    {
                        cityId: 387,
                        name: 'Korasagalla',
                    },
                    {
                        cityId: 430,
                        name: 'Maha Vilachchiya',
                    },
                    {
                        cityId: 460,
                        name: 'Maradankadawala',
                    },
                    {
                        cityId: 483,
                        name: 'Medawachchiya',
                    },
                    {
                        cityId: 495,
                        name: 'Mihintale',
                    },
                    {
                        cityId: 582,
                        name: 'Nochchiyagama',
                    },
                    {
                        cityId: 596,
                        name: 'Oyamaduwa',
                    },
                    {
                        cityId: 597,
                        name: 'Padaviya',
                    },
                    {
                        cityId: 661,
                        name: 'Pothanegama',
                    },
                    {
                        cityId: 666,
                        name: 'Pubbogama',
                    },
                    {
                        cityId: 687,
                        name: 'Rajanganaya',
                    },
                    {
                        cityId: 690,
                        name: 'Rambewa',
                    },
                    {
                        cityId: 721,
                        name: 'Sippukulama',
                    },
                    {
                        cityId: 736,
                        name: 'Talawa',
                    },
                    {
                        cityId: 756,
                        name: 'Thambuthegama',
                    },
                ],
            },
            {
                districtId: '16',
                name: 'Polonnaruwa',
                cities: [
                    {
                        cityId: 37,
                        name: 'Aralaganwila',
                    },
                    {
                        cityId: 58,
                        name: 'Bakamuna',
                    },
                    {
                        cityId: 140,
                        name: 'Damanayaya',
                    },
                    {
                        cityId: 169,
                        name: 'Diyasenapura',
                    },
                    {
                        cityId: 184,
                        name: 'Elahera',
                    },
                    {
                        cityId: 218,
                        name: 'Giritale',
                    },
                    {
                        cityId: 250,
                        name: 'Hingurakdamana',
                    },
                    {
                        cityId: 251,
                        name: 'Hingurakgoda',
                    },
                    {
                        cityId: 287,
                        name: 'Kaduruwela',
                    },
                    {
                        cityId: 350,
                        name: 'Kaudulla',
                    },
                    {
                        cityId: 452,
                        name: 'Manampitiya',
                    },
                    {
                        cityId: 486,
                        name: 'Medirigiriya',
                    },
                    {
                        cityId: 497,
                        name: 'Minneriya',
                    },
                    {
                        cityId: 609,
                        name: 'Palugasdamana',
                    },
                    {
                        cityId: 621,
                        name: 'Pansal Godella',
                    },
                    {
                        cityId: 655,
                        name: 'Polonnaruwa',
                    },
                    {
                        cityId: 669,
                        name: 'Pulasthigama',
                    },
                    {
                        cityId: 716,
                        name: 'Sewanapitiya',
                    },
                    {
                        cityId: 723,
                        name: 'Siripura - Dehiattakandiya',
                    },
                    {
                        cityId: 850,
                        name: 'Welikanda',
                    },
                ],
            },
        ],
    },
    {
        id: 5,
        provinceId: '3',
        name: 'North Western',
        district: [
            {
                districtId: '6',
                name: 'Kurunegala',
                cities: [
                    {
                        cityId: 16,
                        name: 'Alawwa',
                    },
                    {
                        cityId: 25,
                        name: 'Ambanpola',
                    },
                    {
                        cityId: 62,
                        name: 'Bamunawala',
                    },
                    {
                        cityId: 64,
                        name: 'Bandarakoswatte',
                    },
                    {
                        cityId: 67,
                        name: 'Barampola Junction',
                    },
                    {
                        cityId: 77,
                        name: 'Battulu Oya',
                    },
                    {
                        cityId: 89,
                        name: 'Bingiriya',
                    },
                    {
                        cityId: 141,
                        name: 'Dambadeniya',
                    },
                    {
                        cityId: 174,
                        name: 'Dodangaslanda',
                    },
                    {
                        cityId: 178,
                        name: 'Dummalasuriya',
                    },
                    {
                        cityId: 195,
                        name: 'Galapitamulla',
                    },
                    {
                        cityId: 198,
                        name: 'Galgamuwa',
                    },
                    {
                        cityId: 219,
                        name: 'Giriulla',
                    },
                    {
                        cityId: 224,
                        name: 'Gokarella',
                    },
                    {
                        cityId: 226,
                        name: 'Gonagama',
                    },
                    {
                        cityId: 245,
                        name: 'Hettipola',
                    },
                    {
                        cityId: 255,
                        name: 'Hiripitiya',
                    },
                    {
                        cityId: 260,
                        name: 'Horambawa',
                    },
                    {
                        cityId: 266,
                        name: 'Ibbagamuwa',
                    },
                    {
                        cityId: 284,
                        name: 'Kadahapola',
                    },
                    {
                        cityId: 310,
                        name: 'Kalugamuwa Junction - Kalugamuwa',
                    },
                    {
                        cityId: 317,
                        name: 'Kamburupola',
                    },
                    {
                        cityId: 324,
                        name: 'Kandanagedera',
                    },
                    {
                        cityId: 344,
                        name: 'Katumuluwa',
                    },
                    {
                        cityId: 347,
                        name: 'Katupotha',
                    },
                    {
                        cityId: 362,
                        name: 'Keppetiwalana',
                    },
                    {
                        cityId: 364,
                        name: 'Ketawalagedara - Wewagama',
                    },
                    {
                        cityId: 377,
                        name: 'Kobeigane',
                    },
                    {
                        cityId: 404,
                        name: 'Kuliyapitiya',
                    },
                    {
                        cityId: 406,
                        name: 'Kumbukgate',
                    },
                    {
                        cityId: 412,
                        name: 'Kurunegala',
                    },
                    {
                        cityId: 440,
                        name: 'Maho',
                    },
                    {
                        cityId: 443,
                        name: 'Makadura',
                    },
                    {
                        cityId: 466,
                        name: 'Maspotha',
                    },
                    {
                        cityId: 476,
                        name: 'Mavee Ela Junction',
                    },
                    {
                        cityId: 480,
                        name: 'Mawathagama',
                    },
                    {
                        cityId: 488,
                        name: 'Meegalawa',
                    },
                    {
                        cityId: 492,
                        name: 'Melsiripura',
                    },
                    {
                        cityId: 498,
                        name: 'Minuwangate',
                    },
                    {
                        cityId: 515,
                        name: 'Mudukatuwa',
                    },
                    {
                        cityId: 530,
                        name: 'Nagollagama',
                    },
                    {
                        cityId: 531,
                        name: 'Nagollagoda',
                    },
                    {
                        cityId: 540,
                        name: 'Nankawaththa',
                    },
                    {
                        cityId: 543,
                        name: 'Narammala',
                    },
                    {
                        cityId: 544,
                        name: 'Narangoda',
                    },
                    {
                        cityId: 572,
                        name: 'Nikaweratiya',
                    },
                    {
                        cityId: 617,
                        name: 'Pannala',
                    },
                    {
                        cityId: 639,
                        name: 'Pilessa',
                    },
                    {
                        cityId: 653,
                        name: 'Polgahawela',
                    },
                    {
                        cityId: 657,
                        name: 'Polpithigama',
                    },
                    {
                        cityId: 665,
                        name: 'Potuhera',
                    },
                    {
                        cityId: 702,
                        name: 'Ridigama',
                    },
                    {
                        cityId: 706,
                        name: 'Saliya Ashokapura',
                    },
                    {
                        cityId: 709,
                        name: 'Sandalankawa',
                    },
                    {
                        cityId: 773,
                        name: 'Thuththiripitigama - Kadawalagedara',
                    },
                    {
                        cityId: 785,
                        name: 'Udubaddawa',
                    },
                    {
                        cityId: 817,
                        name: 'Vilaththawa - Puliyamkadawala',
                    },
                    {
                        cityId: 833,
                        name: 'Wariyapola',
                    },
                    {
                        cityId: 839,
                        name: 'We - Uda',
                    },
                    {
                        cityId: 843,
                        name: 'Weerapokuna',
                    },
                    {
                        cityId: 863,
                        name: 'Wellawa',
                    },
                    {
                        cityId: 865,
                        name: 'Welpothuwewa - Boruluwewa',
                    },
                    {
                        cityId: 867,
                        name: 'Wennoruwa',
                    },
                    {
                        cityId: 872,
                        name: 'Withikuliya Junction',
                    },
                    {
                        cityId: 876,
                        name: 'Yakwila - Paragammana',
                    },
                    {
                        cityId: 883,
                        name: 'Ilippugamuwa',
                    },
                    {
                        cityId: 886,
                        name: 'Kurunegala Rd - Bopitiya',
                    },
                ],
            },
            {
                districtId: '8',
                name: 'Puttalam',
                cities: [
                    {
                        cityId: 29,
                        name: 'Anamaduwa',
                    },
                    {
                        cityId: 35,
                        name: 'Arachchikattuwa',
                    },
                    {
                        cityId: 42,
                        name: 'Arndigama',
                    },
                    {
                        cityId: 66,
                        name: 'Bangadeniya',
                    },
                    {
                        cityId: 99,
                        name: 'Botalegama',
                    },
                    {
                        cityId: 112,
                        name: 'Chilaw',
                    },
                    {
                        cityId: 145,
                        name: 'Dankotuwa',
                    },
                    {
                        cityId: 190,
                        name: 'Etalai',
                    },
                    {
                        cityId: 275,
                        name: 'Inigodawela',
                    },
                    {
                        cityId: 294,
                        name: 'Kakkapalliya',
                    },
                    {
                        cityId: 306,
                        name: 'Kalpitiya',
                    },
                    {
                        cityId: 307,
                        name: 'Kalpitiya Road - Mampuriya',
                    },
                    {
                        cityId: 451,
                        name: 'Mampuriya',
                    },
                    {
                        cityId: 320,
                        name: 'Kandakudah',
                    },
                    {
                        cityId: 326,
                        name: 'Kandathoduwawa',
                    },
                    {
                        cityId: 346,
                        name: 'Katuneriya',
                    },
                    {
                        cityId: 382,
                        name: 'Kokkawila',
                    },
                    {
                        cityId: 418,
                        name: 'Lunuwila',
                    },
                    {
                        cityId: 420,
                        name: 'Madampe',
                    },
                    {
                        cityId: 426,
                        name: 'Madurankuliya',
                    },
                    {
                        cityId: 435,
                        name: 'Mahawewa',
                    },
                    {
                        cityId: 436,
                        name: 'Mahawewa - Thoduwawa',
                    },
                    {
                        cityId: 462,
                        name: 'Marawila',
                    },
                    {
                        cityId: 484,
                        name: 'Medawakkulama - Andigama',
                    },
                    {
                        cityId: 523,
                        name: 'Mundelama',
                    },
                    {
                        cityId: 535,
                        name: 'Nalladarankattuwa',
                    },
                    {
                        cityId: 546,
                        name: 'Nattandiya',
                    },
                    {
                        cityId: 547,
                        name: 'Nattandiya - Koswatta',
                    },
                    {
                        cityId: 550,
                        name: 'Nawagaththegama',
                    },
                    {
                        cityId: 583,
                        name: 'Noraicholai',
                    },
                    {
                        cityId: 616,
                        name: 'Panirendawa',
                    },
                    {
                        cityId: 670,
                        name: 'Puliyankulama Junction',
                    },
                    {
                        cityId: 680,
                        name: 'Puttalam',
                    },
                    {
                        cityId: 707,
                        name: 'Saliyawewa',
                    },
                    {
                        cityId: 714,
                        name: 'Serakuliya',
                    },
                    {
                        cityId: 733,
                        name: 'Tabbowa',
                    },
                    {
                        cityId: 755,
                        name: 'Thambarawila',
                    },
                    {
                        cityId: 778,
                        name: 'Toppuwa Junction',
                    },
                    {
                        cityId: 807,
                        name: 'Vanatavilluwa',
                    },
                    {
                        cityId: 822,
                        name: 'Waikkal',
                    },
                    {
                        cityId: 854,
                        name: 'Welipennagahamulla',
                    },
                    {
                        cityId: 861,
                        name: 'Wellamankara',
                    },
                    {
                        cityId: 866,
                        name: 'Wennappuwa',
                    },
                ],
            },
        ],
    },
    {
        id: 6,
        provinceId: '5',
        name: 'Sabaragamuwa',
        district: [
            {
                districtId: '22',
                name: 'Kegalle',
                cities: [
                    {
                        cityId: 27,
                        name: 'Amithirigala',
                    },
                    {
                        cityId: 39,
                        name: 'Aranayake',
                    },
                    {
                        cityId: 101,
                        name: 'Bulathkohupitiya',
                    },
                    {
                        cityId: 148,
                        name: 'Dehiowita',
                    },
                    {
                        cityId: 158,
                        name: 'Deraniyagala',
                    },
                    {
                        cityId: 199,
                        name: 'Galigamuwa',
                    },
                    {
                        cityId: 244,
                        name: 'Hemmathagama',
                    },
                    {
                        cityId: 272,
                        name: 'Imbulgasdeniya',
                    },
                    {
                        cityId: 354,
                        name: 'Kegalle',
                    },
                    {
                        cityId: 376,
                        name: 'Kithulgala',
                    },
                    {
                        cityId: 473,
                        name: 'Mattamagoda - Kotiyakumbura',
                    },
                    {
                        cityId: 477,
                        name: 'Mawanella',
                    },
                    {
                        cityId: 569,
                        name: 'Nelundeniya',
                    },
                    {
                        cityId: 691,
                        name: 'Rambukkana',
                    },
                    {
                        cityId: 704,
                        name: 'Ruwanwella',
                    },
                    {
                        cityId: 769,
                        name: 'Thulhiriya',
                    },
                    {
                        cityId: 821,
                        name: 'Waharaka',
                    },
                    {
                        cityId: 830,
                        name: 'Warakapola',
                    },
                    {
                        cityId: 849,
                        name: 'Weligamuwa - Rambukkana',
                    },
                    {
                        cityId: 880,
                        name: 'Yatiyantota',
                    },
                ],
            },
            {
                districtId: '9',
                name: 'Ratnapura',
                cities: [
                    {
                        cityId: 43,
                        name: 'Atakalampanna',
                    },
                    {
                        cityId: 59,
                        name: 'Balangoda',
                    },
                    {
                        cityId: 168,
                        name: 'Divurmpitiya - Gatahatta',
                    },
                    {
                        cityId: 182,
                        name: 'Eheliyagoda',
                    },
                    {
                        cityId: 186,
                        name: 'Embilipitiya',
                    },
                    {
                        cityId: 211,
                        name: 'Ganegama - Pelmadulla',
                    },
                    {
                        cityId: 223,
                        name: 'Godakawela',
                    },
                    {
                        cityId: 247,
                        name: 'Hidellana - Rathnapura',
                    },
                    {
                        cityId: 292,
                        name: 'Kahawatta',
                    },
                    {
                        cityId: 300,
                        name: 'Kalawana',
                    },
                    {
                        cityId: 308,
                        name: 'Kaltota',
                    },
                    {
                        cityId: 372,
                        name: 'Kiriella',
                    },
                    {
                        cityId: 384,
                        name: 'Kolonna',
                    },
                    {
                        cityId: 413,
                        name: 'Kuruwita',
                    },
                    {
                        cityId: 581,
                        name: 'Nivitigala',
                    },
                    {
                        cityId: 605,
                        name: 'Pallebedda',
                    },
                    {
                        cityId: 610,
                        name: 'Pambahinna',
                    },
                    {
                        cityId: 623,
                        name: 'Parakaduwa',
                    },
                    {
                        cityId: 633,
                        name: 'Pelmadulla',
                    },
                    {
                        cityId: 689,
                        name: 'Rakwana',
                    },
                    {
                        cityId: 699,
                        name: 'Ratnapura',
                    },
                    {
                        cityId: 731,
                        name: 'Suriyakanda',
                    },
                    {
                        cityId: 763,
                        name: 'Thimbolketiya',
                    },
                ],
            },
        ],
    },
    {
        id: 7,
        provinceId: '2',
        name: 'Southern',
        district: [
            {
                districtId: '23',
                name: 'Hambantota',
                cities: [
                    {
                        cityId: 24,
                        name: 'Ambalanthota',
                    },
                    {
                        cityId: 31,
                        name: 'Angunukolapelessa',
                    },
                    {
                        cityId: 80,
                        name: 'Beliatta',
                    },
                    {
                        cityId: 94,
                        name: 'Bolana',
                    },
                    {
                        cityId: 146,
                        name: 'Debarawewa',
                    },
                    {
                        cityId: 235,
                        name: 'Hambantota',
                    },
                    {
                        cityId: 264,
                        name: 'Hungama',
                    },
                    {
                        cityId: 299,
                        name: 'Kalametiya',
                    },
                    {
                        cityId: 368,
                        name: 'Kirama',
                    },
                    {
                        cityId: 374,
                        name: 'Kirinda',
                    },
                    {
                        cityId: 417,
                        name: 'Lunugamvehera',
                    },
                    {
                        cityId: 434,
                        name: 'Mahawela - Nakulugama',
                    },
                    {
                        cityId: 494,
                        name: 'Middeniya',
                    },
                    {
                        cityId: 576,
                        name: 'Nilwella',
                    },
                    {
                        cityId: 693,
                        name: 'Ranna',
                    },
                    {
                        cityId: 728,
                        name: 'Sooriyawewa',
                    },
                    {
                        cityId: 729,
                        name: 'Suduwelipelessa Kirinda',
                    },
                    {
                        cityId: 732,
                        name: 'Suriyawewa',
                    },
                    {
                        cityId: 741,
                        name: 'Tangalle',
                    },
                    {
                        cityId: 766,
                        name: 'Thissamaharamaya',
                    },
                    {
                        cityId: 775,
                        name: 'Tissamaharama',
                    },
                    {
                        cityId: 824,
                        name: 'Walasmulla',
                    },
                    {
                        cityId: 825,
                        name: 'Walasmulla Rd - Weeraketiya',
                    },
                    {
                        cityId: 842,
                        name: 'Weeraketiya',
                    },
                    {
                        cityId: 844,
                        name: 'Weerawila',
                    },
                ],
            },
            {
                districtId: '5',
                name: 'Matara',
                cities: [
                    {
                        cityId: 11,
                        name: 'Akuressa',
                    },
                    {
                        cityId: 85,
                        name: 'Bengamuwa',
                    },
                    {
                        cityId: 151,
                        name: 'Deiyandara',
                    },
                    {
                        cityId: 157,
                        name: 'Deniyaya',
                    },
                    {
                        cityId: 161,
                        name: 'Devinuwara',
                    },
                    {
                        cityId: 163,
                        name: 'Dickwella',
                    },
                    {
                        cityId: 173,
                        name: 'Dodanduwa',
                    },
                    {
                        cityId: 210,
                        name: 'Gandara',
                    },
                    {
                        cityId: 232,
                        name: 'Hakmana',
                    },
                    {
                        cityId: 295,
                        name: 'Kakunadura',
                    },
                    {
                        cityId: 315,
                        name: 'Kamburugamuwa',
                    },
                    {
                        cityId: 316,
                        name: 'Kamburupitiya',
                    },
                    {
                        cityId: 400,
                        name: 'Kottegoda',
                    },
                    {
                        cityId: 403,
                        name: 'Kudawella',
                    },
                    {
                        cityId: 468,
                        name: 'Matara',
                    },
                    {
                        cityId: 478,
                        name: 'Mawarala',
                    },
                    {
                        cityId: 485,
                        name: 'Meddawatta',
                    },
                    {
                        cityId: 502,
                        name: 'Mirissa',
                    },
                    {
                        cityId: 511,
                        name: 'Morawaka',
                    },
                    {
                        cityId: 608,
                        name: 'Pallimulla',
                    },
                    {
                        cityId: 644,
                        name: 'Pitabeddara',
                    },
                    {
                        cityId: 677,
                        name: 'Puranawella',
                    },
                    {
                        cityId: 695,
                        name: 'Ransegoda  Hakmana',
                    },
                    {
                        cityId: 761,
                        name: 'Thihagoda',
                    },
                    {
                        cityId: 799,
                        name: 'Urubokka',
                    },
                    {
                        cityId: 823,
                        name: 'Walasgala',
                    },
                    {
                        cityId: 831,
                        name: 'Waralla',
                    },
                    {
                        cityId: 847,
                        name: 'Weligama',
                    },
                ],
            },
            {
                districtId: '4',
                name: 'Galle',
                cities: [
                    {
                        cityId: 3,
                        name: 'Ahangama',
                    },
                    {
                        cityId: 4,
                        name: 'Ahungalla',
                    },
                    {
                        cityId: 20,
                        name: 'Aluthwala',
                    },
                    {
                        cityId: 23,
                        name: 'Ambalangoda',
                    },
                    {
                        cityId: 52,
                        name: 'Baddegama',
                    },
                    {
                        cityId: 60,
                        name: 'Balapitiya',
                    },
                    {
                        cityId: 70,
                        name: 'Batapola',
                    },
                    {
                        cityId: 95,
                        name: 'Boossa',
                    },
                    {
                        cityId: 156,
                        name: 'Denipitiya',
                    },
                    {
                        cityId: 160,
                        name: 'Devata Junction',
                    },
                    {
                        cityId: 185,
                        name: 'Elpitiya',
                    },
                    {
                        cityId: 201,
                        name: 'Galle',
                    },
                    {
                        cityId: 227,
                        name: 'Gonapinuwala',
                    },
                    {
                        cityId: 230,
                        name: 'Habaraduwa',
                    },
                    {
                        cityId: 248,
                        name: 'Hikkaduwa',
                    },
                    {
                        cityId: 253,
                        name: 'Hipankanda - Uragasmanhandiya',
                    },
                    {
                        cityId: 271,
                        name: 'Imaduwa',
                    },
                    {
                        cityId: 298,
                        name: 'Kalaigana',
                    },
                    {
                        cityId: 314,
                        name: 'Kaluwella',
                    },
                    {
                        cityId: 334,
                        name: 'Karandeniya',
                    },
                    {
                        cityId: 348,
                        name: 'Katuwana',
                    },
                    {
                        cityId: 395,
                        name: 'Kotapola',
                    },
                    {
                        cityId: 427,
                        name: 'Magalle',
                    },
                    {
                        cityId: 491,
                        name: 'Meetiyagoda',
                    },
                    {
                        cityId: 532,
                        name: 'Nakiyadeniya',
                    },
                    {
                        cityId: 570,
                        name: 'Neluwa',
                    },
                    {
                        cityId: 643,
                        name: 'Pinnaduwa - Akmeemana',
                    },
                    {
                        cityId: 645,
                        name: 'Pitigala',
                    },
                    {
                        cityId: 648,
                        name: 'Poddala',
                    },
                    {
                        cityId: 697,
                        name: 'Ratgama',
                    },
                    {
                        cityId: 730,
                        name: 'Suduwella',
                    },
                    {
                        cityId: 739,
                        name: 'Talgaswela',
                    },
                    {
                        cityId: 742,
                        name: 'Tawalama',
                    },
                    {
                        cityId: 747,
                        name: 'Thalagaha - Akmeemana',
                    },
                    {
                        cityId: 754,
                        name: 'Thalgampala',
                    },
                    {
                        cityId: 787,
                        name: 'Udugama',
                    },
                    {
                        cityId: 795,
                        name: 'Uragasmanhandiya',
                    },
                    {
                        cityId: 796,
                        name: 'Urala',
                    },
                    {
                        cityId: 829,
                        name: 'Wanduramba',
                    },
                    {
                        cityId: 875,
                        name: 'Yakkalamulla',
                    },
                ],
            },
        ],
    },
    {
        id: 8,
        provinceId: '9',
        name: 'Uva',
        district: [
            {
                districtId: '24',
                name: 'Badulla',
                cities: [
                    {
                        cityId: 22,
                        name: 'Ambagasdowa',
                    },
                    {
                        cityId: 44,
                        name: 'Atampitiya',
                    },
                    {
                        cityId: 54,
                        name: 'Badulla',
                    },
                    {
                        cityId: 55,
                        name: 'Badulla Rd - Halpe',
                    },
                    {
                        cityId: 61,
                        name: 'Ballekatuwa',
                    },
                    {
                        cityId: 65,
                        name: 'Bandarawela',
                    },
                    {
                        cityId: 142,
                        name: 'Dambagalla',
                    },
                    {
                        cityId: 170,
                        name: 'Diyathalawa',
                    },
                    {
                        cityId: 216,
                        name: 'Girandurukotte',
                    },
                    {
                        cityId: 233,
                        name: 'Haldummulla',
                    },
                    {
                        cityId: 234,
                        name: 'Hali Ela',
                    },
                    {
                        cityId: 238,
                        name: 'Haputale',
                    },
                    {
                        cityId: 289,
                        name: 'Kahaniyagoda',
                    },
                    {
                        cityId: 319,
                        name: 'Kandaketiya - Loggaloya Junction',
                    },
                    {
                        cityId: 361,
                        name: 'Keppetipola',
                    },
                    {
                        cityId: 416,
                        name: 'Lunugala',
                    },
                    {
                        cityId: 425,
                        name: 'Madulsima',
                    },
                    {
                        cityId: 438,
                        name: 'Mahiyanganaya',
                    },
                    {
                        cityId: 439,
                        name: 'Mahiyankanaya',
                    },
                    {
                        cityId: 481,
                        name: 'Medagama',
                    },
                    {
                        cityId: 487,
                        name: 'Meegahakiwla',
                    },
                    {
                        cityId: 538,
                        name: 'Namunukula',
                    },
                    {
                        cityId: 626,
                        name: 'Passara',
                    },
                    {
                        cityId: 751,
                        name: 'Thalangamuwa',
                    },
                    {
                        cityId: 851,
                        name: 'Welimada',
                    },
                    {
                        cityId: 884,
                        name: 'Andaulpotha',
                    },
                ],
            },
            {
                districtId: '25',
                name: 'Moneragala',
                cities: [
                    {
                        cityId: 38,
                        name: 'Arambekema - Hambegamuwa',
                    },
                    {
                        cityId: 51,
                        name: 'Badalkumbura',
                    },
                    {
                        cityId: 88,
                        name: 'Bibile',
                    },
                    {
                        cityId: 104,
                        name: 'Buttala',
                    },
                    {
                        cityId: 144,
                        name: 'Danduma',
                    },
                    {
                        cityId: 172,
                        name: 'Dobagahawela',
                    },
                    {
                        cityId: 338,
                        name: 'Kataragama',
                    },
                    {
                        cityId: 391,
                        name: 'Koslanda',
                    },
                    {
                        cityId: 407,
                        name: 'Kumbukkana',
                    },
                    {
                        cityId: 506,
                        name: 'Monaragala',
                    },
                    {
                        cityId: 726,
                        name: 'Siyambalanduwa',
                    },
                    {
                        cityId: 740,
                        name: 'Tanamalwila',
                    },
                    {
                        cityId: 758,
                        name: 'Thelulla',
                    },
                    {
                        cityId: 859,
                        name: 'Weliyaya',
                    },
                    {
                        cityId: 864,
                        name: 'Wellawaya',
                    },
                ],
            },
        ],
    },
    {
        id: 9,
        provinceId: '1',
        name: 'Western',
        district: [
            {
                districtId: '1',
                name: 'Colombo',
                cities: [
                    {
                        cityId: 26,
                        name: 'Ambathale',
                    },
                    {
                        cityId: 46,
                        name: 'Athurugiriya',
                    },
                    {
                        cityId: 49,
                        name: 'Avissawella',
                    },
                    {
                        cityId: 72,
                        name: 'Battaramulla',
                    },
                    {
                        cityId: 93,
                        name: 'Bokundara',
                    },
                    {
                        cityId: 98,
                        name: 'Boralesgamuwa',
                    },
                    {
                        cityId: 115,
                        name: 'Colombo',
                    },
                    {
                        cityId: 116,
                        name: 'Colombo - 02',
                    },
                    {
                        cityId: 117,
                        name: 'Colombo - 03',
                    },
                    {
                        cityId: 118,
                        name: 'Colombo - 04',
                    },
                    {
                        cityId: 119,
                        name: 'Colombo - 05',
                    },
                    {
                        cityId: 120,
                        name: 'Colombo - 06',
                    },
                    {
                        cityId: 121,
                        name: 'Colombo - 07',
                    },
                    {
                        cityId: 122,
                        name: 'Colombo - 08',
                    },
                    {
                        cityId: 123,
                        name: 'Colombo - 09',
                    },
                    {
                        cityId: 124,
                        name: 'Colombo - 10',
                    },
                    {
                        cityId: 125,
                        name: 'Colombo - 11',
                    },
                    {
                        cityId: 126,
                        name: 'Colombo - 13',
                    },
                    {
                        cityId: 127,
                        name: 'Colombo - 14',
                    },
                    {
                        cityId: 128,
                        name: 'Colombo - 15',
                    },
                    {
                        cityId: 149,
                        name: 'Dehiwala',
                    },
                    {
                        cityId: 191,
                        name: 'Ethul Kotte',
                    },
                    {
                        cityId: 207,
                        name: 'Gamgodawila',
                    },
                    {
                        cityId: 220,
                        name: 'Godagama',
                    },
                    {
                        cityId: 228,
                        name: 'Gothatuwa',
                    },
                    {
                        cityId: 237,
                        name: 'Hanwella',
                    },
                    {
                        cityId: 256,
                        name: 'Hokandara North',
                    },
                    {
                        cityId: 257,
                        name: 'Hokandara South',
                    },
                    {
                        cityId: 258,
                        name: 'Homagama',
                    },
                    {
                        cityId: 268,
                        name: 'Ihala Kosgama',
                    },
                    {
                        cityId: 288,
                        name: 'Kaduwela',
                    },
                    {
                        cityId: 309,
                        name: 'Kalubowila',
                    },
                    {
                        cityId: 363,
                        name: 'Kesbewa',
                    },
                    {
                        cityId: 380,
                        name: 'Kohuwela',
                    },
                    {
                        cityId: 388,
                        name: 'Kirulapone',
                    },
                    {
                        cityId: 389,
                        name: 'Kosgama',
                    },
                    {
                        cityId: 392,
                        name: 'Koswatta',
                    },
                    {
                        cityId: 397,
                        name: 'Kotikawatte',
                    },
                    {
                        cityId: 398,
                        name: 'Kottawa',
                    },
                    {
                        cityId: 399,
                        name: 'Kotte',
                    },
                    {
                        cityId: 422,
                        name: 'Madapatha',
                    },
                    {
                        cityId: 424,
                        name: 'Madiwela',
                    },
                    {
                        cityId: 433,
                        name: 'Maharagama',
                    },
                    {
                        cityId: 446,
                        name: 'Malabe',
                    },
                    {
                        cityId: 474,
                        name: 'Mattegoda',
                    },
                    {
                        cityId: 489,
                        name: 'Meegoda',
                    },
                    {
                        cityId: 501,
                        name: 'Mirihana',
                    },
                    {
                        cityId: 508,
                        name: 'Moratuwa',
                    },
                    {
                        cityId: 514,
                        name: 'Mount Lavinia',
                    },
                    {
                        cityId: 519,
                        name: 'Mulleriyawa - New Town',
                    },
                    {
                        cityId: 520,
                        name: 'Mulleriyawa North',
                    },
                    {
                        cityId: 542,
                        name: 'Narahenpita',
                    },
                    {
                        cityId: 551,
                        name: 'Nawala',
                    },
                    {
                        cityId: 553,
                        name: 'Nawinna - High Level Road',
                    },
                    {
                        cityId: 588,
                        name: 'Nugegoda',
                    },
                    {
                        cityId: 595,
                        name: 'Orugodawatta',
                    },
                    {
                        cityId: 600,
                        name: 'Padukka',
                    },
                    {
                        cityId: 601,
                        name: 'Padukka - Meepe Junction',
                    },
                    {
                        cityId: 619,
                        name: 'Pannipitiya',
                    },
                    {
                        cityId: 630,
                        name: 'Pelawetta',
                    },
                    {
                        cityId: 642,
                        name: 'Piliyandala',
                    },
                    {
                        cityId: 654,
                        name: 'Polgasowita',
                    },
                    {
                        cityId: 686,
                        name: 'Rajagiriya',
                    },
                    {
                        cityId: 692,
                        name: 'Ranala',
                    },
                    {
                        cityId: 698,
                        name: 'Ratmalana',
                    },
                    {
                        cityId: 748,
                        name: 'Thalahena',
                    },
                    {
                        cityId: 753,
                        name: 'Thalawathugoda',
                    },
                    {
                        cityId: 826,
                        name: 'Walgama Junction - Athrugiriya',
                    },
                    {
                        cityId: 862,
                        name: 'Wellampitiya',
                    },
                ],
            },
            {
                districtId: '2',
                name: 'Gampaha',
                cities: [
                    {
                        cityId: 5,
                        name: 'Akarawita',
                    },
                    {
                        cityId: 48,
                        name: 'Attangalla',
                    },
                    {
                        cityId: 50,
                        name: 'Badalgama',
                    },
                    {
                        cityId: 56,
                        name: 'Baduragoda',
                    },
                    {
                        cityId: 69,
                        name: 'Bataleeya',
                    },
                    {
                        cityId: 71,
                        name: 'Batepola - Dunagaha',
                    },
                    {
                        cityId: 78,
                        name: 'Batuwatta',
                    },
                    {
                        cityId: 84,
                        name: 'Bemmulla',
                    },
                    {
                        cityId: 90,
                        name: 'Biyagama',
                    },
                    {
                        cityId: 138,
                        name: 'Dalupotha',
                    },
                    {
                        cityId: 152,
                        name: 'Delgoda',
                    },
                    {
                        cityId: 155,
                        name: 'Demanhandiya - Miriswatta',
                    },
                    {
                        cityId: 162,
                        name: 'Dewalapola',
                    },
                    {
                        cityId: 164,
                        name: 'Dikowita',
                    },
                    {
                        cityId: 166,
                        name: 'Divulapitiya',
                    },
                    {
                        cityId: 176,
                        name: 'Dompe',
                    },
                    {
                        cityId: 179,
                        name: 'Dunagaha',
                    },
                    {
                        cityId: 183,
                        name: 'Ekala',
                    },
                    {
                        cityId: 208,
                        name: 'Gampaha',
                    },
                    {
                        cityId: 212,
                        name: 'Ganemulla',
                    },
                    {
                        cityId: 217,
                        name: 'Giridara',
                    },
                    {
                        cityId: 242,
                        name: 'Hedala',
                    },
                    {
                        cityId: 243,
                        name: 'Heiyanthuduwa',
                    },
                    {
                        cityId: 267,
                        name: 'Idigolla',
                    },
                    {
                        cityId: 279,
                        name: 'Jaela',
                    },
                    {
                        cityId: 285,
                        name: 'Kadawatha',
                    },
                    {
                        cityId: 296,
                        name: 'Kal - Eliya',
                    },
                    {
                        cityId: 297,
                        name: 'Kalagedihena',
                    },
                    {
                        cityId: 322,
                        name: 'Kandana',
                    },
                    {
                        cityId: 336,
                        name: 'Katana',
                    },
                    {
                        cityId: 341,
                        name: 'Kattuwa',
                    },
                    {
                        cityId: 345,
                        name: 'Katunayake',
                    },
                    {
                        cityId: 349,
                        name: 'Katuwellagama Junction',
                    },
                    {
                        cityId: 357,
                        name: 'Kelaniya',
                    },
                    {
                        cityId: 366,
                        name: 'Kimbulapitiya',
                    },
                    {
                        cityId: 371,
                        name: 'Kiribathgoda',
                    },
                    {
                        cityId: 373,
                        name: 'Kirillawela - Imbulgoda',
                    },
                    {
                        cityId: 375,
                        name: 'Kirindiwela',
                    },
                    {
                        cityId: 378,
                        name: 'Kochchikade',
                    },
                    {
                        cityId: 393,
                        name: 'Kotadeniyawa',
                    },
                    {
                        cityId: 401,
                        name: 'Kotugoda',
                    },
                    {
                        cityId: 410,
                        name: 'Kurana - Katunayaka',
                    },
                    {
                        cityId: 415,
                        name: 'Loluwagoda',
                    },
                    {
                        cityId: 419,
                        name: 'Mabima',
                    },
                    {
                        cityId: 421,
                        name: 'Madampella',
                    },
                    {
                        cityId: 431,
                        name: 'Mahabage',
                    },
                    {
                        cityId: 432,
                        name: 'Mahara',
                    },
                    {
                        cityId: 444,
                        name: 'Makola',
                    },
                    {
                        cityId: 450,
                        name: 'Malwatu - Hiripitiya',
                    },
                    {
                        cityId: 461,
                        name: 'Marandagahamula',
                    },
                    {
                        cityId: 479,
                        name: 'Mawaramandiya',
                    },
                    {
                        cityId: 496,
                        name: 'Millathe - Kiridiwela',
                    },
                    {
                        cityId: 499,
                        name: 'Minuwangoda',
                    },
                    {
                        cityId: 500,
                        name: 'Mirigama',
                    },
                    {
                        cityId: 516,
                        name: 'Mudungoda',
                    },
                    {
                        cityId: 529,
                        name: 'Nagoda',
                    },
                    {
                        cityId: 534,
                        name: 'Nalla',
                    },
                    {
                        cityId: 545,
                        name: 'Naranwala',
                    },
                    {
                        cityId: 559,
                        name: 'Negombo',
                    },
                    {
                        cityId: 567,
                        name: 'Nelligahamulla - Atthanagalla',
                    },
                    {
                        cityId: 579,
                        name: 'Nittambuwa',
                    },
                    {
                        cityId: 607,
                        name: 'Pallewela',
                    },
                    {
                        cityId: 611,
                        name: 'Pamunugama',
                    },
                    {
                        cityId: 627,
                        name: 'Pasyala',
                    },
                    {
                        cityId: 631,
                        name: 'Peliyagoda',
                    },
                    {
                        cityId: 646,
                        name: 'Pitipana',
                    },
                    {
                        cityId: 647,
                        name: 'Pitipana - South',
                    },
                    {
                        cityId: 649,
                        name: 'Pohonnaruwa - Meerigama',
                    },
                    {
                        cityId: 667,
                        name: 'Pugoda',
                    },
                    {
                        cityId: 682,
                        name: 'Puwakwetiya - Kadawata',
                    },
                    {
                        cityId: 683,
                        name: 'Raddolugama',
                    },
                    {
                        cityId: 685,
                        name: 'Ragama',
                    },
                    {
                        cityId: 694,
                        name: 'Ranpokunugama',
                    },
                    {
                        cityId: 713,
                        name: 'Seeduwa',
                    },
                    {
                        cityId: 727,
                        name: 'Siyambalape',
                    },
                    {
                        cityId: 760,
                        name: 'Thibirigaskatuwa',
                    },
                    {
                        cityId: 762,
                        name: 'Thihariya',
                    },
                    {
                        cityId: 788,
                        name: 'Udugampola',
                    },
                    {
                        cityId: 798,
                        name: 'Urapola',
                    },
                    {
                        cityId: 814,
                        name: 'Veyangoda',
                    },
                    {
                        cityId: 834,
                        name: 'Wattala',
                    },
                    {
                        cityId: 840,
                        name: 'Webada',
                    },
                    {
                        cityId: 856,
                        name: 'Welisara - Kandana',
                    },
                    {
                        cityId: 857,
                        name: 'Welisara - Maththumagala',
                    },
                    {
                        cityId: 858,
                        name: 'Weliweriya',
                    },
                    {
                        cityId: 869,
                        name: 'Weweldeniya',
                    },
                    {
                        cityId: 871,
                        name: 'Wilimbula - Henegama',
                    },
                    {
                        cityId: 874,
                        name: 'Yakkala',
                    },
                ],
            },
            {
                districtId: '3',
                name: 'Kaluthara',
                cities: [
                    {
                        cityId: 2,
                        name: 'Agalawatta',
                    },
                    {
                        cityId: 19,
                        name: 'Aluthgama',
                    },
                    {
                        cityId: 32,
                        name: 'Anguruwathota',
                    },
                    {
                        cityId: 36,
                        name: 'Arakawila - Handapangoda',
                    },
                    {
                        cityId: 57,
                        name: 'Badureliya',
                    },
                    {
                        cityId: 63,
                        name: 'Bandaragama',
                    },
                    {
                        cityId: 68,
                        name: 'Batagoda',
                    },
                    {
                        cityId: 83,
                        name: 'Bellapitiya - Anguruwathota',
                    },
                    {
                        cityId: 86,
                        name: 'Beruwela - Gorakadoowa',
                    },
                    {
                        cityId: 87,
                        name: 'Beruwala',
                    },
                    {
                        cityId: 102,
                        name: 'Bulathsinhala',
                    },
                    {
                        cityId: 175,
                        name: 'Dodangoda',
                    },
                    {
                        cityId: 261,
                        name: 'Horana',
                    },
                    {
                        cityId: 274,
                        name: 'Ingiriya',
                    },
                    {
                        cityId: 277,
                        name: 'Ittapana',
                    },
                    {
                        cityId: 311,
                        name: 'Kalutara North',
                    },
                    {
                        cityId: 312,
                        name: 'Kalutara South',
                    },
                    {
                        cityId: 343,
                        name: 'Katukurunda',
                    },
                    {
                        cityId: 405,
                        name: 'Kumbuka West',
                    },
                    {
                        cityId: 428,
                        name: 'Maggona',
                    },
                    {
                        cityId: 475,
                        name: 'Matugama',
                    },
                    {
                        cityId: 504,
                        name: 'Molligoda',
                    },
                    {
                        cityId: 507,
                        name: 'Moragahahena',
                    },
                    {
                        cityId: 513,
                        name: 'Morontuduwa',
                    },
                    {
                        cityId: 556,
                        name: 'Neboda',
                    },
                    {
                        cityId: 612,
                        name: 'Panadura',
                    },
                    {
                        cityId: 613,
                        name: 'Panapitiya - Kaluthara',
                    },
                    {
                        cityId: 628,
                        name: 'Payagala',
                    },
                    {
                        cityId: 629,
                        name: 'Pelawatte',
                    },
                    {
                        cityId: 651,
                        name: 'Pokunuwita',
                    },
                    {
                        cityId: 652,
                        name: 'Polegoda - Mahagama',
                    },
                    {
                        cityId: 660,
                        name: 'Poruwadanda',
                    },
                    {
                        cityId: 819,
                        name: 'Wadduwa',
                    },
                    {
                        cityId: 845,
                        name: 'Wekada - panadura',
                    },
                    {
                        cityId: 853,
                        name: 'Welipenna',
                    },
                    {
                        cityId: 855,
                        name: 'Welipenne - Site B',
                    },
                    {
                        cityId: 877,
                        name: 'Yatadola - Mathugama',
                    },
                ],
            },
        ],
    },
];
import fetch from 'node-fetch';
import * as fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const finalFile = join(__dirname, '..', 'data', 'newScrappedData.json');
const allSheds = {};
const allIds = new Set();
const statsNoIds = [];
const statsDuplicateIds = [];
(() => __awaiter(void 0, void 0, void 0, function* () {
    for (const province of allCities) {
        const { provinceId, district: districts } = province;
        for (const district of districts) {
            const { districtId } = district;
            const response = yield fetch('https://fuel.gov.lk/api/v1/sheddetails/search', {
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    pragma: 'no-cache',
                },
                body: JSON.stringify({
                    province: provinceId,
                    district: districtId,
                    fuelType: 'p92',
                }),
                method: 'POST',
            });
            if (!response.ok) {
                console.log('Error: ', response.status);
                debugger;
            }
            else {
                const data = yield response.json();
                if (data.length > 0) {
                    for (const shed of data) {
                        const { shedId } = shed;
                        const p92Response = yield fetch(`https://fuel.gov.lk/api/v1/sheddetails/${shedId}/p92`, {
                            headers: {
                                accept: 'application/json, text/plain, */*',
                                'cache-control': 'no-cache',
                                pragma: 'no-cache',
                            },
                            body: null,
                            method: 'GET',
                        });
                        if (!p92Response.ok) {
                            console.log('Error: ', p92Response.status);
                            debugger;
                        }
                        else {
                            const p92Data = yield p92Response.json();
                            if (allIds.has(shedId)) {
                                console.log('Duplicate ID: ', shedId);
                            }
                            else {
                                allIds.add(shedId);
                                const thisProvince = allCities.find((p) => p.provinceId === provinceId);
                                if (!thisProvince) {
                                    console.log(`Province not found: ${provinceId}`);
                                    debugger;
                                }
                                const thisDistrict = thisProvince.district.find((d) => d.districtId === districtId);
                                if (!thisDistrict) {
                                    console.log(`thisDistrict not found: ${thisDistrict}`);
                                    debugger;
                                }
                                // thisDistrict.cities
                                allSheds[shedId] = Object.assign(Object.assign({ p92Data }, shed), { districtId,
                                    provinceId });
                                console.log(`Downloading ${shedId}`);
                            }
                        }
                    }
                }
                else {
                    console.log('Error: ', response.status);
                    debugger;
                }
            }
        }
    }
    fs.writeFileSync(finalFile, JSON.stringify(allSheds));
}))();
//# sourceMappingURL=cities.js.map